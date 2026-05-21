import { getPrisma } from '@/lib/database/prisma';
import { logActivityEvent } from '@/lib/activity/logActivityEvent';
import { createGithubOctokit } from '@/lib/github/auth';
import { incidentKey, severityFromScore, upsertIncident } from '@/lib/incidents/incidentManager';
import type { GitHubWebhookPayload } from '@/types';

export type PullRequestRiskClassification = 'SAFE' | 'MODERATE' | 'HIGH RISK' | 'CRITICAL';

type ChangedFile = {
  filename: string;
  status?: string;
  additions?: number;
  deletions?: number;
  changes?: number;
  patch?: string;
};

type PullRequestReviewInput = {
  repository: string;
  owner: string;
  repo: string;
  prNumber: number;
  title?: string;
  author?: string;
  branch?: string;
  baseBranch?: string;
  changedFileCount?: number;
  changedFiles?: ChangedFile[];
  relatedUrl?: string;
  installationId?: number;
};

type ReviewSignal = {
  score: number;
  label: string;
  detail: string;
};

const sensitivePatterns = [
  { pattern: /(^|\/)(auth|session|oauth|login|middleware)/i, score: 30, label: 'authentication-sensitive surface' },
  { pattern: /(payment|billing|checkout|invoice|stripe)/i, score: 30, label: 'payment-sensitive surface' },
  { pattern: /(prisma|schema\.prisma|migration|database|db\/)/i, score: 25, label: 'database persistence surface' },
  { pattern: /(\.github\/workflows|workflow|ci|deploy)/i, score: 22, label: 'workflow-sensitive surface' },
  { pattern: /(package\.json|package-lock\.json|pnpm-lock|yarn\.lock|next\.config|vercel\.json|\.env|config)/i, score: 20, label: 'configuration or dependency surface' },
  { pattern: /(security|secret|token|crypto|webhook)/i, score: 24, label: 'security-sensitive surface' },
];

// made by bob
export async function runAutonomousPullRequestReview(input: PullRequestReviewInput) {
  const prisma = getPrisma();
  const startedAt = new Date();
  const reviewKey = ['pr-review', input.repository, input.prNumber].join(':');
  const changedFiles = await resolveChangedFiles(input);
  const modules = inferChangedModules(changedFiles);
  const history = await loadHistoricalSignals(input.repository, changedFiles.map((file) => file.filename), input.prNumber);
  const signals = buildReviewSignals(input, changedFiles, history);
  const riskScore = Math.min(100, signals.reduce((sum, signal) => sum + signal.score, 0));
  const riskClassification = classifyRisk(riskScore);
  const confidenceScore = calculateConfidenceScore(changedFiles, history);
  const architectureImpact = buildArchitectureImpact(modules, changedFiles);
  const workflowImpact = buildWorkflowImpact(changedFiles);
  const affectedDependencies = buildAffectedDependencies(changedFiles);
  const suspiciousPatterns = signals.map((signal) => signal.label);
  const reasoning = buildReasoning(input, riskClassification, riskScore, confidenceScore, signals, history);
  const recommendations = buildRecommendations(riskClassification, changedFiles, signals);
  const deploymentConcerns = buildDeploymentConcerns(changedFiles, riskClassification);
  const inlineInsights = buildInlineInsights(changedFiles, signals);

  const review = await prisma.pullRequestReview.upsert({
    where: { reviewKey },
    update: {
      title: input.title,
      author: input.author,
      branch: input.branch,
      status: 'COMPLETED',
      riskClassification,
      riskScore,
      confidenceScore,
      changedFiles: JSON.stringify(changedFiles.map((file) => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
      }))),
      changedModules: JSON.stringify(modules),
      architectureImpact,
      workflowImpact,
      affectedDependencies: JSON.stringify(affectedDependencies),
      suspiciousPatterns: JSON.stringify(suspiciousPatterns),
      reasoning,
      recommendations: JSON.stringify(recommendations),
      deploymentConcerns: JSON.stringify(deploymentConcerns),
      inlineInsights: JSON.stringify(inlineInsights),
      relatedUrl: input.relatedUrl,
      completedAt: new Date(),
    },
    create: {
      reviewKey,
      prNumber: input.prNumber,
      repository: input.repository,
      title: input.title,
      author: input.author,
      branch: input.branch,
      status: 'COMPLETED',
      riskClassification,
      riskScore,
      confidenceScore,
      changedFiles: JSON.stringify(changedFiles.map((file) => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
      }))),
      changedModules: JSON.stringify(modules),
      architectureImpact,
      workflowImpact,
      affectedDependencies: JSON.stringify(affectedDependencies),
      suspiciousPatterns: JSON.stringify(suspiciousPatterns),
      reasoning,
      recommendations: JSON.stringify(recommendations),
      deploymentConcerns: JSON.stringify(deploymentConcerns),
      inlineInsights: JSON.stringify(inlineInsights),
      relatedUrl: input.relatedUrl,
      startedAt,
      completedAt: new Date(),
    },
  });

  await prisma.pullRequestReviewStep.deleteMany({ where: { reviewId: review.id } });
  await prisma.pullRequestReviewStep.createMany({
    data: buildReviewSteps(review.id, {
      changedFiles,
      modules,
      signals,
      history,
      workflowImpact,
      reasoning,
    }),
  });

  await logActivityEvent({
    eventType: 'pr_review',
    repository: input.repository,
    severity: riskScore >= 80 ? 'danger' : riskScore >= 55 ? 'warning' : 'success',
    status: 'completed',
    summary: `PR #${input.prNumber} reviewed as ${riskClassification} (${riskScore}/100)`,
    details: {
      confidenceScore,
      changedFiles: changedFiles.map((file) => file.filename),
      changedModules: modules,
      suspiciousPatterns,
    },
    relatedPr: input.prNumber,
    relatedUrl: input.relatedUrl,
  });

  if (riskScore >= 70) {
    await upsertIncident({
      incidentKey: incidentKey(['pr-review', input.repository, input.prNumber]),
      severity: severityFromScore(riskScore),
      repository: input.repository,
      affectedBranch: input.branch,
      affectedFiles: changedFiles.map((file) => file.filename),
      engineeringSummary: reasoning,
      status: 'ANALYZING',
      relatedPr: input.prNumber,
      relatedUrl: input.relatedUrl,
      historySummary: `Autonomous PR review classified PR #${input.prNumber} as ${riskClassification}`,
      historyDetails: {
        riskScore,
        confidenceScore,
        changedModules: modules,
        suspiciousPatterns,
      },
    });
  }

  return prisma.pullRequestReview.findUniqueOrThrow({
    where: { id: review.id },
    include: { steps: { orderBy: { startedAt: 'asc' } } },
  });
}

export async function runAutonomousPullRequestReviewFromWebhook(payload: GitHubWebhookPayload) {
  const repository = payload.repository?.full_name || payload.repository?.name || 'unknown';
  const owner = payload.repository?.owner?.login || repository.split('/')[0] || 'unknown';
  const repo = payload.repository?.name || repository.split('/')[1] || repository;
  const prNumber = payload.pull_request?.number || 0;

  if (!prNumber) {
    throw new Error('Pull request number is required for autonomous review.');
  }

  return runAutonomousPullRequestReview({
    repository,
    owner,
    repo,
    prNumber,
    title: payload.pull_request?.title,
    author: payload.pull_request?.user?.login || payload.sender?.login,
    branch: payload.pull_request?.head?.ref,
    baseBranch: payload.pull_request?.base?.ref || payload.repository?.default_branch,
    changedFileCount: payload.pull_request?.changed_files,
    changedFiles: payload.pull_request?.files?.flatMap((file) => file.filename ? [{
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      patch: file.patch,
    }] : []) || [],
    relatedUrl: payload.pull_request?.html_url,
    installationId: payload.installation?.id,
  });
}

export async function runAutonomousPullRequestReviewForUser(input: {
  userId: string;
  prNumber: number;
}) {
  const prisma = getPrisma();
  const [repository, user] = await Promise.all([
    prisma.connectedRepository.findUnique({ where: { userId: input.userId } }),
    prisma.user.findUnique({ where: { id: input.userId }, select: { githubAccessToken: true, githubUsername: true } }),
  ]);

  if (!repository) {
    throw new Error('Connect a repository before reviewing pull requests.');
  }

  if (!user?.githubAccessToken) {
    throw new Error('GitHub authentication is required for pull request review.');
  }

  const { decryptSecret } = await import('@/lib/security/secrets');
  const token = decryptSecret(user.githubAccessToken);
  const [pullRequest, files] = await Promise.all([
    fetchGitHubJson<{
      number: number;
      title?: string;
      html_url?: string;
      changed_files?: number;
      user?: { login?: string };
      head?: { ref?: string };
      base?: { ref?: string };
    }>(`https://api.github.com/repos/${repository.owner}/${repository.repoName}/pulls/${input.prNumber}`, token),
    fetchGitHubJson<ChangedFile[]>(`https://api.github.com/repos/${repository.owner}/${repository.repoName}/pulls/${input.prNumber}/files?per_page=100`, token),
  ]);

  return runAutonomousPullRequestReview({
    repository: `${repository.owner}/${repository.repoName}`,
    owner: repository.owner,
    repo: repository.repoName,
    prNumber: pullRequest.number,
    title: pullRequest.title,
    author: pullRequest.user?.login || user.githubUsername,
    branch: pullRequest.head?.ref,
    baseBranch: pullRequest.base?.ref,
    changedFileCount: pullRequest.changed_files,
    changedFiles: files,
    relatedUrl: pullRequest.html_url,
  });
}

async function resolveChangedFiles(input: PullRequestReviewInput): Promise<ChangedFile[]> {
  if (input.changedFiles?.length) {
    return input.changedFiles;
  }

  if (input.installationId) {
    try {
      const octokit = await createGithubOctokit(input.installationId);
      const response = await octokit.pulls.listFiles({
        owner: input.owner,
        repo: input.repo,
        pull_number: input.prNumber,
        per_page: 100,
      });

      return response.data.map((file) => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        patch: file.patch,
      }));
    } catch (error) {
      console.error('[PR Review] GitHub PR file fetch failed:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  const count = input.changedFileCount || 0;
  return count > 0
    ? [{ filename: `metadata-only-${count}-changed-files`, changes: count }]
    : [];
}

async function fetchGitHubJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`GitHub PR fetch failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function loadHistoricalSignals(repository: string, files: string[], prNumber: number) {
  const prisma = getPrisma();
  const [incidents, analyses] = await Promise.all([
    prisma.incident.findMany({
      where: { repository },
      orderBy: { openedAt: 'desc' },
      take: 30,
    }),
    prisma.pullRequestAnalysis.findMany({
      where: { repository },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);
  const fileSet = new Set(files);
  const overlappingIncidents = incidents.filter((incident) => {
    const affectedFiles = parseStringArray(incident.affectedFiles);
    return affectedFiles.some((file) => fileSet.has(file));
  });
  const priorPrRisk = analyses.find((analysis) => analysis.prNumber === prNumber)?.riskScore || 0;

  return {
    incidentCount: incidents.filter((incident) => incident.status !== 'RESOLVED').length,
    overlappingIncidents,
    priorPrRisk,
  };
}

function buildReviewSignals(
  input: PullRequestReviewInput,
  files: ChangedFile[],
  history: Awaited<ReturnType<typeof loadHistoricalSignals>>
): ReviewSignal[] {
  const signals: ReviewSignal[] = [];
  const changedFileCount = files.length || input.changedFileCount || 0;

  if (changedFileCount > 25) signals.push({ score: 35, label: 'large pull request blast radius', detail: `${changedFileCount} files changed` });
  else if (changedFileCount > 10) signals.push({ score: 20, label: 'elevated pull request size', detail: `${changedFileCount} files changed` });

  for (const file of files) {
    const filename = file.filename;
    for (const sensitive of sensitivePatterns) {
      if (sensitive.pattern.test(filename)) {
        signals.push({ score: sensitive.score, label: sensitive.label, detail: filename });
      }
    }

    if (file.status === 'removed' || file.status === 'renamed') {
      signals.push({ score: 15, label: 'destructive file operation', detail: `${file.status}: ${filename}` });
    }

    if ((file.changes || 0) > 400 || (file.additions || 0) + (file.deletions || 0) > 400) {
      signals.push({ score: 15, label: 'large patch surface', detail: filename });
    }
  }

  const touchesSource = files.some((file) => /(^|\/)(src|app|lib|pages|server)\//i.test(file.filename));
  const touchesTests = files.some((file) => /(test|spec|__tests__)/i.test(file.filename));
  if (touchesSource && !touchesTests) {
    signals.push({ score: 15, label: 'source changes without visible test updates', detail: 'No test/spec files detected in changed file list' });
  }

  if (history.overlappingIncidents.length > 0) {
    signals.push({
      score: Math.min(25, history.overlappingIncidents.length * 10),
      label: 'incident-correlated file changes',
      detail: `${history.overlappingIncidents.length} overlapping incident(s)`,
    });
  }

  if (history.priorPrRisk >= 70) signals.push({ score: 18, label: 'existing PR analysis marked high risk', detail: `Prior risk ${history.priorPrRisk}/100` });
  else if (history.priorPrRisk >= 40) signals.push({ score: 10, label: 'existing PR analysis marked moderate risk', detail: `Prior risk ${history.priorPrRisk}/100` });

  if (history.incidentCount >= 3) {
    signals.push({ score: 12, label: 'repository has active operational incidents', detail: `${history.incidentCount} active incident(s)` });
  }

  return collapseSignals(signals);
}

function collapseSignals(signals: ReviewSignal[]): ReviewSignal[] {
  const grouped = new Map<string, ReviewSignal>();

  for (const signal of signals) {
    const existing = grouped.get(signal.label);
    if (!existing) {
      grouped.set(signal.label, signal);
      continue;
    }

    grouped.set(signal.label, {
      score: Math.max(existing.score, signal.score),
      label: signal.label,
      detail: [existing.detail, signal.detail].filter(Boolean).join('; '),
    });
  }

  return Array.from(grouped.values());
}

function classifyRisk(score: number): PullRequestRiskClassification {
  if (score >= 80) return 'CRITICAL';
  if (score >= 55) return 'HIGH RISK';
  if (score >= 25) return 'MODERATE';
  return 'SAFE';
}

function calculateConfidenceScore(files: ChangedFile[], history: Awaited<ReturnType<typeof loadHistoricalSignals>>): number {
  const fileConfidence = files.length > 0 && !files[0]?.filename.startsWith('metadata-only') ? 55 : 25;
  const historyConfidence = history.priorPrRisk > 0 ? 20 : 8;
  const incidentConfidence = history.incidentCount > 0 ? 15 : 7;
  return Math.min(95, fileConfidence + historyConfidence + incidentConfidence);
}

function inferChangedModules(files: ChangedFile[]): string[] {
  const modules = new Set<string>();

  for (const file of files) {
    const parts = file.filename.split('/');
    if (parts[0] === '.github') modules.add('.github/workflows');
    else if (parts[0] === 'src' && parts[1]) modules.add(`src/${parts[1]}`);
    else if (parts[0] === 'app' && parts[1]) modules.add(`app/${parts[1]}`);
    else modules.add(parts[0] || file.filename);
  }

  return Array.from(modules).slice(0, 12);
}

function buildArchitectureImpact(modules: string[], files: ChangedFile[]): string {
  if (files.length === 0) {
    return 'No file-level architecture impact could be computed because no changed file list was available.';
  }

  const criticalModules = modules.filter((module) => /auth|api|lib|database|prisma|workflow|config/i.test(module));
  return criticalModules.length
    ? `PR touches ${modules.length} module area(s), including operationally sensitive areas: ${criticalModules.join(', ')}.`
    : `PR touches ${modules.length} module area(s): ${modules.join(', ')}. No critical architecture boundary was detected from paths alone.`;
}

function buildWorkflowImpact(files: ChangedFile[]): string {
  const workflowFiles = files.filter((file) => /\.github\/workflows|package\.json|package-lock\.json|next\.config|vercel\.json|test|spec/i.test(file.filename));

  if (workflowFiles.length === 0) {
    return 'No direct workflow definition or test runner impact detected from changed file paths.';
  }

  return `Workflow-sensitive changes detected in ${workflowFiles.map((file) => file.filename).slice(0, 6).join(', ')}. CI validation should be treated as a release gate.`;
}

function buildAffectedDependencies(files: ChangedFile[]): string[] {
  return files
    .filter((file) => /package\.json|package-lock\.json|pnpm-lock|yarn\.lock|requirements\.txt|go\.mod|cargo\.toml/i.test(file.filename))
    .map((file) => file.filename);
}

function buildReasoning(
  input: PullRequestReviewInput,
  classification: PullRequestRiskClassification,
  riskScore: number,
  confidenceScore: number,
  signals: ReviewSignal[],
  history: Awaited<ReturnType<typeof loadHistoricalSignals>>
): string {
  const signalText = signals.length
    ? signals.map((signal) => `${signal.label} (${signal.detail})`).join('; ')
    : 'no high-risk path or historical incident signal detected';

  return [
    `PR #${input.prNumber} is classified as ${classification} with risk ${riskScore}/100 and confidence ${confidenceScore}/100.`,
    `Reasoning: ${signalText}.`,
    history.overlappingIncidents.length
      ? `Operational context: ${history.overlappingIncidents.length} incident(s) overlap with changed files.`
      : 'Operational context: no direct incident overlap found for changed files.',
  ].join(' ');
}

function buildRecommendations(classification: PullRequestRiskClassification, files: ChangedFile[], signals: ReviewSignal[]): string[] {
  const recommendations = new Set<string>();

  recommendations.add('Require all configured CI checks to pass before merge.');
  if (classification === 'HIGH RISK' || classification === 'CRITICAL') {
    recommendations.add('Request focused review from an owner of the affected module.');
    recommendations.add('Run regression-focused validation against touched workflow and application surfaces.');
  }
  if (files.some((file) => /auth|payment|database|prisma|migration/i.test(file.filename))) {
    recommendations.add('Validate auth/payment/database paths with targeted tests or manual smoke checks.');
  }
  if (signals.some((signal) => signal.label.includes('source changes without'))) {
    recommendations.add('Add or confirm tests for changed source paths before deployment.');
  }

  return Array.from(recommendations);
}

function buildDeploymentConcerns(files: ChangedFile[], classification: PullRequestRiskClassification): string[] {
  return [
    ...(classification === 'CRITICAL' ? ['Do not auto-merge; require human release approval.'] : []),
    ...(files.some((file) => /migration|schema\.prisma|database/i.test(file.filename)) ? ['Database schema or migration changes may require rollback planning.'] : []),
    ...(files.some((file) => /\.github\/workflows|vercel\.json|next\.config/i.test(file.filename)) ? ['Build/deploy pipeline behavior may change after merge.'] : []),
    ...(files.some((file) => /package\.json|lock/i.test(file.filename)) ? ['Dependency updates can alter runtime behavior and CI determinism.'] : []),
  ];
}

function buildInlineInsights(files: ChangedFile[], signals: ReviewSignal[]): string[] {
  const signalDetails = new Set(signals.flatMap((signal) => signal.detail.split('; ').map((item) => item.trim())));

  return files
    .filter((file) => signalDetails.has(file.filename) || /auth|payment|database|workflow|config|package|prisma|test|spec/i.test(file.filename))
    .slice(0, 8)
    .map((file) => `${file.filename}: review operational impact, rollback expectations, and validation coverage.`);
}

function buildReviewSteps(
  reviewId: string,
  context: {
    changedFiles: ChangedFile[];
    modules: string[];
    signals: ReviewSignal[];
    history: Awaited<ReturnType<typeof loadHistoricalSignals>>;
    workflowImpact: string;
    reasoning: string;
  }
) {
  const now = new Date();

  return [
    {
      reviewId,
      stage: 'changed_file_inspection',
      status: 'completed',
      summary: `[PR Engine] Inspected ${context.changedFiles.length} changed file signal(s).`,
      evidence: JSON.stringify(context.changedFiles.map((file) => file.filename)),
      startedAt: now,
      completedAt: now,
    },
    {
      reviewId,
      stage: 'architecture_mapping',
      status: 'completed',
      summary: `[Architecture Analyzer] Mapped affected modules: ${context.modules.join(', ') || 'none detected'}.`,
      evidence: JSON.stringify(context.modules),
      startedAt: now,
      completedAt: now,
    },
    {
      reviewId,
      stage: 'regression_risk_evaluation',
      status: 'completed',
      summary: `[Regression Engine] Evaluated ${context.signals.length} risk signal(s).`,
      evidence: JSON.stringify(context.signals),
      startedAt: now,
      completedAt: now,
    },
    {
      reviewId,
      stage: 'workflow_impact_check',
      status: 'completed',
      summary: `[Workflow Intelligence] ${context.workflowImpact}`,
      evidence: context.workflowImpact,
      startedAt: now,
      completedAt: now,
    },
    {
      reviewId,
      stage: 'engineering_reasoning',
      status: 'completed',
      summary: '[Bob Intelligence] Generated deterministic engineering reasoning from PR and operational signals.',
      evidence: JSON.stringify({
        reasoning: context.reasoning,
        overlappingIncidents: context.history.overlappingIncidents.length,
      }),
      startedAt: now,
      completedAt: now,
    },
  ];
}

function parseStringArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

// Made with Bob
// made by bob
