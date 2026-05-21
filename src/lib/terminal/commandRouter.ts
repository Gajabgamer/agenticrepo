import type { AgentCoordinationRun, ConnectedRepository, EngineeringMemory, GithubEvent, PullRequestAnalysis, PullRequestReview, User, WorkflowRecovery } from '@prisma/client';
import { generateEngineeringSummary } from '@/lib/ai/generateEngineeringSummary';
import { aiAnalyzer } from '@/lib/ai/analyzer';
import { analyzeWorkflowFailure } from '@/lib/github/analyzeWorkflowFailure';
import { calculateRegressionRisk } from '@/lib/github/calculateRegressionRisk';
import type { SuspiciousCommit } from '@/lib/github/correlateRecentCommits';
import { parseWorkflowLogs } from '@/lib/github/parseWorkflowLogs';
import { createWorkflowRunWebhookPayload } from '@/lib/testing/mockPayloads';
import { runAutonomousInvestigation } from '@/lib/investigations/investigationEngine';
import { analyzeConnectedRepository } from '@/lib/repository/repositoryIntelligence';
import { runAutonomousPullRequestReviewForUser } from '@/lib/pr-review/prReviewEngine';
import { runWorkflowRecovery } from '@/lib/recovery/workflowRecoveryEngine';
import { getEngineeringMemorySnapshot, refreshEngineeringMemory } from '@/lib/memory/engineeringMemoryEngine';
import { runAgentCoordination } from '@/lib/agents/coordinationEngine';
import { assembleOptimizedContext, getContextMemoryStatus } from '@/lib/context/contextEngineeringEngine';

export type TerminalTone = 'info' | 'success' | 'warning' | 'danger' | 'muted';
export type TerminalBadge = 'AgenticRepo' | 'Workflow Engine' | 'Regression Engine' | 'GitHub' | 'Bob Intelligence' | 'AutoFix System' | 'PR Engine' | 'Architecture Analyzer' | 'Workflow Intelligence' | 'Recovery Engine' | 'Validation Engine' | 'Memory Core' | 'Knowledge Graph' | 'Agent Network' | 'Context Engine';

export type TerminalLine = {
  tone: TerminalTone;
  badge: TerminalBadge;
  text: string;
  timestamp: string;
};

export type TerminalUser = Pick<
  User,
  'bobApiKey' | 'groqApiKey' | 'preferredAiProvider' | 'githubWebhookSecret' | 'autoFixEnabled' | 'confidenceThreshold'
> | null;

export const terminalCommands = [
  'help',
  'clear',
  'analyze-repo',
  'repo-summary',
  'generate-docs',
  'scan-regressions',
  'show-workflows',
  'inspect-pr <id>',
  'review-pr <id>',
  'analyze-pr-risk',
  'workflow-impact',
  'explain-pr',
  'investigate-failure',
  'correlate-commits',
  'engineering-summary',
  'run-autofix',
  'show-incidents',
  'ai-analyze',
  'recover-workflow',
  'stabilize-repo',
  'rerun-analysis',
  'show-recovery-plan',
  'self-heal',
  'validate-fix',
  'memory-status',
  'context-sources',
  'optimize-context',
  'recent-investigations',
  'repo-memory',
  'token-usage',
  'similar-incidents',
  'repo-history',
  'incident-patterns',
  'workflow-memory',
  'engineering-insights',
  'show-agents',
  'active-investigations',
  'coordination-status',
  'assign-analysis',
  'engineering-network',
  'investigation-flow',
  'analyze-incident',
  'deep-scan',
  'repo-investigation',
  'repo-map',
  'explain-module',
  'architecture-summary',
  'detect-hotspots',
  'generate-architecture-docs',
] as const;

const commandAliases = new Map([
  ['autofix-run', 'run-autofix'],
  ['ai-summary', 'engineering-summary'],
]);

const executableCommands = new Set(
  terminalCommands
    .filter((command) => command !== 'help' && command !== 'clear')
    .map((command) => command.split(' ')[0])
);

const sampleWorkflowLogs = `
2026-05-21T10:30:45.123Z [error] Test suite failed in src/api/users.test.ts
2026-05-21T10:30:45.234Z Error: Expected 200 but got 404 at src/api/users.test.ts:45:12
2026-05-21T10:30:45.345Z TypeError: Cannot read properties of undefined at src/services/user-service.ts
2026-05-21T10:30:46.001Z error: failed to compile src/components/Header.tsx
2026-05-21T10:30:46.567Z [fail] 3 tests failed, 12 passed
`;

const fixtureSuspiciousCommits: SuspiciousCommit[] = [
  {
    sha: 'abc1234def5678',
    author: 'github-actions',
    message: 'Update user service response handling',
    matchedFiles: ['src/services/user-service.ts', 'src/api/users.test.ts'],
  },
  {
    sha: 'fed9876cba4321',
    author: 'repo-maintainer',
    message: 'Refactor shared header data flow',
    matchedFiles: ['src/components/Header.tsx'],
  },
];

export function parseTerminalCommand(input: string): { command: string; args: string[] } {
  const parts = input.trim().split(/\s+/).filter(Boolean);
  const rawCommand = parts[0]?.toLowerCase() || '';
  const command = commandAliases.get(rawCommand) || rawCommand;

  return {
    command,
    args: parts.slice(1),
  };
}

export function isAllowedTerminalCommand(command: string): boolean {
  return executableCommands.has(command);
}

// made by bob
export async function executeTerminalCommand({
  command,
  args,
  repository,
  user,
  userId,
  recentAnalyses,
  recentReviews,
  recentRecoveries,
  recentMemories,
  recentCoordinationRuns,
  recentEvents,
}: {
  command: string;
  args: string[];
  repository: ConnectedRepository | null;
  user: TerminalUser;
  userId?: string;
  recentAnalyses: PullRequestAnalysis[];
  recentReviews: PullRequestReview[];
  recentRecoveries: WorkflowRecovery[];
  recentMemories: EngineeringMemory[];
  recentCoordinationRuns: AgentCoordinationRun[];
  recentEvents: GithubEvent[];
}): Promise<TerminalLine[]> {
  const context = buildTerminalContext(repository, user, recentAnalyses, recentReviews, recentRecoveries, recentMemories, recentCoordinationRuns, recentEvents, userId);

  switch (command) {
    case 'analyze-repo':
      return analyzeRepository(context);
    case 'repo-summary':
      return repositorySummary(context);
    case 'generate-docs':
      return generateDocs(context);
    case 'scan-regressions':
      return scanRegressions(context);
    case 'show-workflows':
      return showWorkflows(context);
    case 'inspect-pr':
      return inspectPullRequest(args[0], context);
    case 'review-pr':
      return reviewPullRequest(args[0], context);
    case 'analyze-pr-risk':
      return analyzePullRequestRisk(context);
    case 'workflow-impact':
      return pullRequestWorkflowImpact(context);
    case 'explain-pr':
      return explainPullRequest(context);
    case 'investigate-failure':
    case 'analyze-incident':
    case 'deep-scan':
    case 'repo-investigation':
      return investigateFailure(context);
    case 'correlate-commits':
      return correlateCommits(context);
    case 'engineering-summary':
      return engineeringSummary(context);
    case 'run-autofix':
      return runAutofix(context);
    case 'show-incidents':
      return showIncidents(context);
    case 'ai-analyze':
      return aiAnalyze(context);
    case 'recover-workflow':
    case 'stabilize-repo':
    case 'rerun-analysis':
    case 'self-heal':
      return recoverWorkflow(command, context);
    case 'show-recovery-plan':
      return showRecoveryPlan(context);
    case 'validate-fix':
      return validateFix(context);
    case 'memory-status':
      return memoryStatus(context);
    case 'context-sources':
      return contextSources(context);
    case 'optimize-context':
      return optimizeContext(context);
    case 'recent-investigations':
      return recentInvestigations(context);
    case 'repo-memory':
      return repoMemory(context);
    case 'token-usage':
      return tokenUsage(context);
    case 'similar-incidents':
      return similarIncidents(context);
    case 'repo-history':
      return repoHistory(context);
    case 'incident-patterns':
      return incidentPatterns(context);
    case 'workflow-memory':
      return workflowMemory(context);
    case 'engineering-insights':
      return engineeringInsights(context);
    case 'show-agents':
      return showAgents();
    case 'active-investigations':
      return activeInvestigations(context);
    case 'coordination-status':
      return coordinationStatus(context);
    case 'assign-analysis':
      return assignAnalysis(context);
    case 'engineering-network':
      return engineeringNetwork(context);
    case 'investigation-flow':
      return investigationFlow(context);
    case 'repo-map':
    case 'architecture-summary':
    case 'detect-hotspots':
    case 'generate-architecture-docs':
    case 'explain-module':
      return repositoryIntelligenceCommand(command, args, context);
    default:
      return [line('danger', 'AgenticRepo', 'Command handler missing.')];
  }
}

function buildTerminalContext(
  repository: ConnectedRepository | null,
  user: TerminalUser,
  recentAnalyses: PullRequestAnalysis[],
  recentReviews: PullRequestReview[],
  recentRecoveries: WorkflowRecovery[],
  recentMemories: EngineeringMemory[],
  recentCoordinationRuns: AgentCoordinationRun[],
  recentEvents: GithubEvent[],
  userId?: string
) {
  const workflowPayload = createWorkflowRunWebhookPayload({
    owner: repository?.owner || 'local-owner',
    repo: repository?.repoName || 'local-repo',
    branch: repository?.defaultBranch || 'main',
    defaultBranch: repository?.defaultBranch || 'main',
  });
  const workflowAnalysis = analyzeWorkflowFailure(workflowPayload);
  const parsedLogs = parseWorkflowLogs(sampleWorkflowLogs);
  const regressionRisk = calculateRegressionRisk({
    severityScore: workflowAnalysis?.severityScore || 0,
    detectedErrors: parsedLogs.errors,
    detectedFiles: parsedLogs.files,
    suspiciousCommits: fixtureSuspiciousCommits,
    branch: repository?.defaultBranch || 'main',
  });
  const provider = user?.preferredAiProvider === 'groq' ? 'Groq' : 'IBM Bob';
  const providerConnected = user?.preferredAiProvider === 'groq'
    ? Boolean(user?.groqApiKey || process.env.GROQ_API_KEY)
    : Boolean(user?.bobApiKey || process.env.BOB_API_KEY);

  return {
    repository,
    user,
    recentAnalyses,
    recentReviews,
    recentRecoveries,
    recentMemories,
    recentCoordinationRuns,
    recentEvents,
    workflowAnalysis,
    parsedLogs,
    regressionRisk,
    provider,
    providerConnected,
    repoName: repository ? `${repository.owner}/${repository.repoName}` : 'no repository connected',
    userId,
  };
}

function analyzeRepository(context: ReturnType<typeof buildTerminalContext>): TerminalLine[] {
  return [
    line('info', 'AgenticRepo', `Analyzing repository architecture for ${context.repoName}...`),
    context.repository
      ? line('success', 'GitHub', `Connected repository on ${context.repository.defaultBranch}.`)
      : line('warning', 'GitHub', 'Repository selection required before deep GitHub operations.'),
    line('info', 'Workflow Engine', `${context.recentEvents.length} recent GitHub event record(s) loaded.`),
    line('success', 'Regression Engine', `${context.recentAnalyses.length} pull request analysis record(s) available.`),
    line(context.providerConnected ? 'success' : 'warning', 'Bob Intelligence', `${context.provider}: ${context.providerConnected ? 'ready' : 'API key required'}.`),
  ];
}

function repositorySummary(context: ReturnType<typeof buildTerminalContext>): TerminalLine[] {
  return [
    line('info', 'AgenticRepo', 'Repository summary'),
    line(context.repository ? 'success' : 'warning', 'GitHub', `Target: ${context.repoName}`),
    line('muted', 'GitHub', `Clone URL: ${context.repository?.cloneUrl || 'not configured'}`),
    line('muted', 'GitHub', `Default branch: ${context.repository?.defaultBranch || 'unknown'}`),
    line(context.user?.githubWebhookSecret || process.env.GITHUB_WEBHOOK_SECRET ? 'success' : 'warning', 'Workflow Engine', `Webhook: ${context.user?.githubWebhookSecret || process.env.GITHUB_WEBHOOK_SECRET ? 'secured' : 'secret missing'}`),
    line('info', 'AutoFix System', `Auto-fix mode: ${context.user?.autoFixEnabled ? 'enabled' : 'manual approval'}`),
  ];
}

function generateDocs(context: ReturnType<typeof buildTerminalContext>): TerminalLine[] {
  return [
    line('info', 'AgenticRepo', `Generating documentation outline for ${context.repoName}...`),
    line('success', 'Bob Intelligence', '# Engineering Intelligence Map'),
    line('success', 'Bob Intelligence', `- Repository: ${context.repoName}`),
    line('success', 'Bob Intelligence', `- Default branch: ${context.repository?.defaultBranch || 'unknown'}`),
    line('success', 'Bob Intelligence', '- Monitored signals: workflow failures, regressions, suspicious commits, auto-fix PRs'),
    line(context.providerConnected ? 'success' : 'warning', 'Bob Intelligence', `${context.provider} ${context.providerConnected ? 'ready for generated docs' : 'requires API key before provider-backed docs'}`),
  ];
}

function scanRegressions(context: ReturnType<typeof buildTerminalContext>): TerminalLine[] {
  if (context.recentAnalyses.length === 0) {
    return [
      line('info', 'Regression Engine', 'Scanning deterministic workflow fixture because no stored PR analyses exist yet...'),
      line(context.regressionRisk.confidenceLevel === 'HIGH' ? 'danger' : 'warning', 'Regression Engine', `Risk=${context.regressionRisk.regressionRiskScore}/100 confidence=${context.regressionRisk.confidenceLevel}`),
      line('muted', 'Workflow Engine', context.parsedLogs.summary),
    ];
  }

  return [
    line('info', 'Regression Engine', 'Scanning recent regression analysis records...'),
    ...context.recentAnalyses.map((analysis) => line(
      analysis.riskScore >= 70 ? 'danger' : analysis.riskScore >= 40 ? 'warning' : 'success',
      'Regression Engine',
      `PR #${analysis.prNumber} ${analysis.repository} risk=${analysis.riskScore}/100 :: ${analysis.summary}`
    )),
  ];
}

function showWorkflows(context: ReturnType<typeof buildTerminalContext>): TerminalLine[] {
  return [
    line('info', 'Workflow Engine', 'Reading recent workflow event records...'),
    ...formatEvents(context.recentEvents),
    line('muted', 'Workflow Engine', `Current fixture analysis: ${context.workflowAnalysis?.summary || 'No failed workflow fixture available.'}`),
  ];
}

function inspectPullRequest(id: string | undefined, context: ReturnType<typeof buildTerminalContext>): TerminalLine[] {
  const prNumber = Number(id);

  if (!id || Number.isNaN(prNumber)) {
    return [
      line('danger', 'GitHub', 'inspect-pr requires a numeric id.'),
      line('muted', 'GitHub', 'Example: inspect-pr 42'),
    ];
  }

  const review = context.recentReviews.find((item) => item.prNumber === prNumber);
  const match = context.recentAnalyses.find((analysis) => analysis.prNumber === prNumber);

  if (review) {
    return [
      line('info', 'PR Engine', `Inspecting PR #${review.prNumber}`),
      line(review.riskScore >= 80 ? 'danger' : review.riskScore >= 55 ? 'warning' : 'success', 'Regression Engine', `Classification: ${review.riskClassification} risk=${review.riskScore}/100 confidence=${review.confidenceScore}/100`),
      line('info', 'Architecture Analyzer', review.architectureImpact),
      line('info', 'Workflow Intelligence', review.workflowImpact),
      line('success', 'Bob Intelligence', review.reasoning),
    ];
  }

  if (!match) {
    return [
      line('warning', 'GitHub', `No local analysis found for PR #${prNumber}.`),
      line('muted', 'Workflow Engine', 'Webhook analysis will appear after pull_request or workflow_run events are processed.'),
    ];
  }

  return [
    line('info', 'GitHub', `Inspecting PR #${match.prNumber}`),
    line(match.riskScore >= 70 ? 'danger' : match.riskScore >= 40 ? 'warning' : 'success', 'Regression Engine', `Risk score: ${match.riskScore}/100`),
    line('success', 'Bob Intelligence', match.summary),
    line('muted', 'GitHub', `Repository: ${match.repository}`),
  ];
}

async function reviewPullRequest(id: string | undefined, context: ReturnType<typeof buildTerminalContext>): Promise<TerminalLine[]> {
  const prNumber = Number(id);

  if (!id || Number.isNaN(prNumber)) {
    return [
      line('danger', 'PR Engine', 'review-pr requires a numeric id.'),
      line('muted', 'PR Engine', 'Example: review-pr 42'),
    ];
  }

  if (!context.userId) {
    return [line('danger', 'PR Engine', 'Authenticated user context is required to run live PR review.')];
  }

  try {
    const review = await runAutonomousPullRequestReviewForUser({
      userId: context.userId,
      prNumber,
    });

    return [
      line('info', 'PR Engine', `[PR Engine] Inspected changed files for PR #${review.prNumber}...`),
      line('info', 'Architecture Analyzer', `[Architecture Analyzer] ${review.architectureImpact}`),
      line(review.riskScore >= 80 ? 'danger' : review.riskScore >= 55 ? 'warning' : 'success', 'Regression Engine', `[Regression Engine] ${review.riskClassification} risk=${review.riskScore}/100 confidence=${review.confidenceScore}/100`),
      line('info', 'Workflow Intelligence', `[Workflow Intelligence] ${review.workflowImpact}`),
      line('success', 'Bob Intelligence', `[Bob Intelligence] ${review.reasoning}`),
    ];
  } catch (error) {
    return [line('danger', 'PR Engine', error instanceof Error ? error.message : 'PR review failed.')];
  }
}

function analyzePullRequestRisk(context: ReturnType<typeof buildTerminalContext>): TerminalLine[] {
  const review = context.recentReviews[0];

  if (!review) {
    return [
      line('warning', 'PR Engine', 'No autonomous PR review records found yet.'),
      line('muted', 'PR Engine', 'Run review-pr <id> or open/update a pull request webhook.'),
    ];
  }

  return [
    line('info', 'PR Engine', `Latest PR review: #${review.prNumber} ${review.repository}`),
    line(review.riskScore >= 80 ? 'danger' : review.riskScore >= 55 ? 'warning' : 'success', 'Regression Engine', `${review.riskClassification} risk=${review.riskScore}/100 confidence=${review.confidenceScore}/100`),
    line('success', 'Bob Intelligence', review.reasoning),
  ];
}

function pullRequestWorkflowImpact(context: ReturnType<typeof buildTerminalContext>): TerminalLine[] {
  const review = context.recentReviews[0];

  if (!review) {
    return [line('warning', 'Workflow Intelligence', 'No PR workflow impact record is available yet.')];
  }

  return [
    line('info', 'Workflow Intelligence', `PR #${review.prNumber} workflow impact`),
    line('success', 'Workflow Intelligence', review.workflowImpact),
  ];
}

function explainPullRequest(context: ReturnType<typeof buildTerminalContext>): TerminalLine[] {
  const review = context.recentReviews[0];

  if (!review) {
    return [line('warning', 'Bob Intelligence', 'No PR reasoning record is available yet.')];
  }

  return [
    line('info', 'Bob Intelligence', `Explaining PR #${review.prNumber}...`),
    line('success', 'Bob Intelligence', review.reasoning),
    ...parseJsonArray(review.recommendations).map((recommendation) => line('success', 'PR Engine', recommendation)),
  ];
}

async function investigateFailure(context: ReturnType<typeof buildTerminalContext>): Promise<TerminalLine[]> {
  const investigation = await runAutonomousInvestigation({
    repository: context.repoName,
    triggerType: 'terminal',
    relatedWorkflow: context.workflowAnalysis ? 'Deploy and Test' : undefined,
    branch: context.repository?.defaultBranch,
  });

  return [
    line('info', 'Workflow Engine', 'CI failure detected. Running existing workflow failure analyzer...'),
    line('danger', 'Workflow Engine', context.workflowAnalysis?.summary || 'No failed workflow payload available.'),
    line('info', 'Workflow Engine', 'Parsing workflow logs...'),
    line('warning', 'Workflow Engine', context.parsedLogs.summary),
    ...context.parsedLogs.errors.slice(0, 4).map((error) => line('danger', 'Workflow Engine', error)),
    line('success', 'AgenticRepo', `Investigation persisted: ${investigation.id}`),
  ];
}

function correlateCommits(context: ReturnType<typeof buildTerminalContext>): TerminalLine[] {
  return [
    line('info', 'Regression Engine', 'Correlating suspicious commits against detected files...'),
    ...fixtureSuspiciousCommits.map((commit) => line(
      'warning',
      'Regression Engine',
      `${commit.sha.slice(0, 7)} by ${commit.author} touched ${commit.matchedFiles.join(', ')} :: ${commit.message}`
    )),
    line('muted', 'GitHub', context.repository ? 'Live GitHub correlation can run from webhook context with installation credentials.' : 'Connect a repository to enable live GitHub correlation context.'),
  ];
}

async function engineeringSummary(context: ReturnType<typeof buildTerminalContext>): Promise<TerminalLine[]> {
  const bundle = await assembleOptimizedContext({
    repository: context.repository ? context.repoName : undefined,
    provider: context.user?.preferredAiProvider,
    purpose: 'analysis',
    workflowName: context.workflowAnalysis ? 'Deploy and Test' : undefined,
    files: context.parsedLogs.files,
  });
  const summary = context.workflowAnalysis
    ? generateEngineeringSummary({
        workflowAnalysis: context.workflowAnalysis,
        parsedLogAnalysis: context.parsedLogs,
        suspiciousCommits: fixtureSuspiciousCommits,
        regressionRisk: context.regressionRisk,
      }).summary
    : 'No workflow failure analysis available.';

  return [
    line('info', 'Context Engine', `Assembled ${bundle.includedBlocks.length} high-value context block(s), ${bundle.estimatedTokens}/${bundle.tokenBudget} estimated tokens.`),
    line('info', 'Bob Intelligence', `${context.provider} generating engineering summary context...`),
    ...summary.split('\n').filter(Boolean).slice(0, 16).map((text) => line('success', 'Bob Intelligence', text)),
  ];
}

function runAutofix(context: ReturnType<typeof buildTerminalContext>): TerminalLine[] {
  const eligible = Boolean(context.repository && context.providerConnected && context.user?.autoFixEnabled);

  return [
    line('info', 'AutoFix System', 'Checking auto-fix execution gates...'),
    line(context.repository ? 'success' : 'warning', 'GitHub', context.repository ? `Repository ready: ${context.repoName}` : 'Repository not connected'),
    line(context.providerConnected ? 'success' : 'warning', 'Bob Intelligence', `${context.provider}: ${context.providerConnected ? 'connected' : 'API key missing'}`),
    line(context.user?.autoFixEnabled ? 'success' : 'warning', 'AutoFix System', `Auto-fix mode: ${context.user?.autoFixEnabled ? 'enabled' : 'manual approval required'}`),
    line('muted', 'AutoFix System', 'Safe fixes remain limited to imports, null checks, semicolons, and console typo fixes.'),
    line(eligible ? 'success' : 'warning', 'AutoFix System', eligible ? 'Execution gate passed. Webhook-triggered workflow can create a reviewable PR.' : 'Execution gate blocked. No branch or PR created from terminal command.'),
  ];
}

function showIncidents(context: ReturnType<typeof buildTerminalContext>): TerminalLine[] {
  const incidents = context.recentEvents.filter((event) => event.eventType.includes('failure') || event.eventType.includes('regression'));

  return [
    line('info', 'Workflow Engine', 'Incident feed'),
    ...formatEvents(incidents),
  ];
}

async function aiAnalyze(context: ReturnType<typeof buildTerminalContext>): Promise<TerminalLine[]> {
  const bundle = await assembleOptimizedContext({
    repository: context.repository ? context.repoName : undefined,
    provider: context.user?.preferredAiProvider,
    purpose: 'analysis',
    workflowName: context.workflowAnalysis ? 'Deploy and Test' : undefined,
    files: context.parsedLogs.files,
  });
  const result = await aiAnalyzer.analyze({
    type: 'code_review',
    content: `${context.workflowAnalysis?.summary || context.repoName}\n\n${bundle.promptPreamble}`,
    context: {
      repository: context.repoName,
      provider: context.provider,
      regressionRisk: context.regressionRisk,
      optimizedContext: {
        estimatedTokens: bundle.estimatedTokens,
        contextSources: bundle.contextSources,
      },
    },
  });

  return [
    line('info', 'Context Engine', `Optimized AI context: ${bundle.estimatedTokens}/${bundle.tokenBudget} tokens, saved ${bundle.savedTokens}.`),
    line('info', 'Bob Intelligence', `${context.provider} analysis pipeline invoked through existing AI analyzer.`),
    line(result.severity === 'high' || result.severity === 'critical' ? 'danger' : result.severity === 'medium' ? 'warning' : 'success', 'Bob Intelligence', result.analysis),
    ...result.suggestions.map((suggestion) => line('success', 'Bob Intelligence', suggestion)),
  ];
}

async function recoverWorkflow(command: string, context: ReturnType<typeof buildTerminalContext>): Promise<TerminalLine[]> {
  const recovery = await runWorkflowRecovery({
    repository: context.repoName,
    workflowName: 'Deploy and Test',
    branch: context.repository?.defaultBranch,
    failureAnalysis: context.workflowAnalysis || undefined,
    logAnalysis: context.parsedLogs,
    suspiciousCommits: fixtureSuspiciousCommits,
    regressionRisk: context.regressionRisk,
    cloneUrl: context.repository?.cloneUrl,
    defaultBranch: context.repository?.defaultBranch,
    executeAutoFix: command === 'self-heal' && Boolean(context.repository && context.user?.autoFixEnabled && context.providerConnected),
  });

  return [
    line('info', 'Recovery Engine', '[Recovery Engine] Investigating workflow instability...'),
    line('warning', 'Workflow Engine', `[Log Intelligence] ${context.parsedLogs.summary}`),
    line(context.regressionRisk.confidenceLevel === 'HIGH' ? 'danger' : 'warning', 'Regression Engine', `[Regression System] risk=${context.regressionRisk.regressionRiskScore}/100 confidence=${context.regressionRisk.confidenceLevel}`),
    line('info', 'Bob Intelligence', `[Bob Intelligence] Strategy selected: ${recovery.strategy}`),
    line(recovery.autoFixEligible ? 'success' : 'warning', 'AutoFix System', `[AutoFix Engine] ${recovery.autoFixEligible ? 'Safe remediation path available' : 'Manual remediation gate active'}`),
    line('success', 'Validation Engine', `[Validation Engine] ${recovery.validationSummary}`),
    line(recovery.status === 'STABILIZED' ? 'success' : 'warning', 'Recovery Engine', `Recovery ${recovery.status}: stabilization=${recovery.stabilizationProbability}% confidence=${recovery.confidenceScore}%`),
  ];
}

function showRecoveryPlan(context: ReturnType<typeof buildTerminalContext>): TerminalLine[] {
  const recovery = context.recentRecoveries[0];

  if (!recovery) {
    return [
      line('warning', 'Recovery Engine', 'No recovery plan is available yet.'),
      line('muted', 'Recovery Engine', 'Run recover-workflow or process a failed workflow_run webhook.'),
    ];
  }

  return [
    line('info', 'Recovery Engine', `Latest recovery plan for ${recovery.repository}`),
    line('warning', 'Recovery Engine', `Strategy=${recovery.strategy} status=${recovery.status}`),
    line('success', 'Bob Intelligence', recovery.probableRootCause),
    line('success', 'AutoFix System', recovery.proposedRemediation),
    line('info', 'Validation Engine', recovery.validationSummary),
  ];
}

function validateFix(context: ReturnType<typeof buildTerminalContext>): TerminalLine[] {
  const recovery = context.recentRecoveries[0];

  if (!recovery) {
    return [line('warning', 'Validation Engine', 'No recovery record exists to validate yet.')];
  }

  return [
    line('info', 'Validation Engine', `Validating latest recovery for ${recovery.workflowName || 'workflow'}...`),
    line(recovery.stabilizationProbability >= 75 ? 'success' : 'warning', 'Validation Engine', `Stabilization probability: ${recovery.stabilizationProbability}%`),
    line(recovery.autoFixExecuted ? 'success' : 'warning', 'AutoFix System', recovery.autoFixExecuted ? 'Recovery PR was generated; wait for CI result before closing incident.' : 'No recovery PR generated; manual validation remains required.'),
  ];
}

async function memoryStatus(context: ReturnType<typeof buildTerminalContext>): Promise<TerminalLine[]> {
  const snapshot = await refreshEngineeringMemory(context.repository ? context.repoName : undefined);

  return [
    line('info', 'Memory Core', `Memory refreshed for ${snapshot.repository}`),
    line('success', 'Knowledge Graph', `${snapshot.stats.nodeCount} node(s), ${snapshot.stats.edgeCount} edge(s), ${snapshot.stats.memoryCount} memory record(s)`),
    line(snapshot.stats.highRiskMemoryCount > 0 ? 'warning' : 'success', 'Memory Core', `${snapshot.stats.highRiskMemoryCount} high-risk memory record(s), ${snapshot.stats.unstableWorkflowCount} unstable workflow pattern(s)`),
  ];
}

async function contextSources(context: ReturnType<typeof buildTerminalContext>): Promise<TerminalLine[]> {
  const bundle = await getContextMemoryStatus(context.repository ? context.repoName : undefined, context.user?.preferredAiProvider);

  return [
    line('info', 'Context Engine', `Retrieved ${bundle.includedBlocks.length} compressed context block(s) for ${bundle.provider.toUpperCase()}.`),
    ...bundle.contextSources.slice(0, 10).map((source) => line('success', 'Context Engine', `✓ ${source}`)),
    line('muted', 'Context Engine', `${bundle.skippedBlocks} lower-priority block(s) skipped to avoid noisy prompts.`),
  ];
}

async function optimizeContext(context: ReturnType<typeof buildTerminalContext>): Promise<TerminalLine[]> {
  const bundle = await assembleOptimizedContext({
    repository: context.repository ? context.repoName : undefined,
    provider: context.user?.preferredAiProvider,
    purpose: 'terminal',
    workflowName: context.workflowAnalysis ? 'Deploy and Test' : undefined,
    files: context.parsedLogs.files,
    branch: context.repository?.defaultBranch,
    refresh: true,
  });

  return [
    line('info', 'Context Engine', 'Refreshing memory and assembling AI-ready operational context...'),
    line('success', 'Context Engine', `Estimated tokens: ${bundle.estimatedTokens}/${bundle.tokenBudget}`),
    line('success', 'Memory Core', `Saved approximately ${bundle.savedTokens} token(s) vs raw operational history.`),
    line('info', 'Context Engine', `Compression ratio: ${bundle.compressionRatio}% with ${bundle.includedBlocks.length} included block(s).`),
  ];
}

function recentInvestigations(context: ReturnType<typeof buildTerminalContext>): TerminalLine[] {
  const investigationEvents = context.recentEvents.filter((event) => event.eventType === 'repository_investigation');

  return [
    line('info', 'Context Engine', 'Recent investigation context'),
    ...(investigationEvents.length
      ? investigationEvents.map((event) => line('success', 'Workflow Engine', `${event.createdAt.toISOString()} :: ${event.eventType}`))
      : [line('warning', 'Workflow Engine', 'No recent investigation activity event is available in terminal context.')]),
  ];
}

function repoMemory(context: ReturnType<typeof buildTerminalContext>): TerminalLine[] {
  if (context.recentMemories.length === 0) {
    return [line('warning', 'Memory Core', 'No repository memory blocks are loaded yet. Run optimize-context or memory-status.')];
  }

  return [
    line('info', 'Memory Core', `Repository memory loaded for ${context.repoName}`),
    ...context.recentMemories.slice(0, 8).map((memory) => line(
      memory.severity === 'HIGH' || memory.severity === 'CRITICAL' ? 'warning' : 'success',
      'Memory Core',
      `${memory.memoryType}: ${memory.subject} confidence=${memory.confidenceScore}%`
    )),
  ];
}

async function tokenUsage(context: ReturnType<typeof buildTerminalContext>): Promise<TerminalLine[]> {
  const bundle = await getContextMemoryStatus(context.repository ? context.repoName : undefined, context.user?.preferredAiProvider);

  return [
    line('info', 'Context Engine', `Provider profile: ${bundle.provider.toUpperCase()}`),
    line(bundle.estimatedTokens > bundle.tokenBudget ? 'danger' : 'success', 'Context Engine', `Estimated prompt context: ${bundle.estimatedTokens}/${bundle.tokenBudget} tokens`),
    line('success', 'Context Engine', `Token savings: ${bundle.savedTokens}; compression ratio: ${bundle.compressionRatio}%`),
    line('muted', 'Context Engine', `Layers: session=${bundle.stats.sessionBlocks}, repository=${bundle.stats.repositoryBlocks}, incident=${bundle.stats.incidentBlocks}, cache=${bundle.stats.cacheBlocks}`),
  ];
}

function similarIncidents(context: ReturnType<typeof buildTerminalContext>): TerminalLine[] {
  const memories = context.recentMemories.filter((memory) => ['failure_pattern', 'module_hotspot', 'workflow_instability'].includes(memory.memoryType));

  if (memories.length === 0) {
    return [line('warning', 'Memory Core', 'No similar incident memory is available yet. Run memory-status after incidents are recorded.')];
  }

  return [
    line('info', 'Memory Core', 'Similar operational memories'),
    ...memories.slice(0, 6).map((memory) => line(memory.severity === 'HIGH' || memory.severity === 'CRITICAL' ? 'danger' : 'warning', 'Memory Core', `${memory.subject}: ${memory.summary}`)),
  ];
}

function repoHistory(context: ReturnType<typeof buildTerminalContext>): TerminalLine[] {
  return [
    line('info', 'Knowledge Graph', `Repository history for ${context.repoName}`),
    line('success', 'Workflow Engine', `${context.recentEvents.length} recent GitHub event record(s)`),
    line('success', 'Regression Engine', `${context.recentAnalyses.length} PR analysis record(s)`),
    line('success', 'Recovery Engine', `${context.recentRecoveries.length} recovery record(s)`),
    line('success', 'Memory Core', `${context.recentMemories.length} memory record(s)`),
  ];
}

function incidentPatterns(context: ReturnType<typeof buildTerminalContext>): TerminalLine[] {
  const patterns = context.recentMemories.filter((memory) => memory.memoryType === 'failure_pattern');

  if (patterns.length === 0) {
    return [line('warning', 'Memory Core', 'No recurring failure patterns have been learned yet.')];
  }

  return [
    line('info', 'Memory Core', 'Recurring incident patterns'),
    ...patterns.slice(0, 8).map((memory) => line(memory.severity === 'HIGH' ? 'danger' : 'warning', 'Memory Core', `${memory.subject} occurrence=${memory.occurrenceCount} confidence=${memory.confidenceScore}%`)),
  ];
}

function workflowMemory(context: ReturnType<typeof buildTerminalContext>): TerminalLine[] {
  const workflows = context.recentMemories.filter((memory) => memory.memoryType === 'workflow_instability');

  if (workflows.length === 0) {
    return [line('warning', 'Workflow Engine', 'No workflow instability memory is available yet.')];
  }

  return [
    line('info', 'Workflow Engine', 'Workflow memory'),
    ...workflows.slice(0, 8).map((memory) => line(memory.severity === 'HIGH' ? 'danger' : 'warning', 'Workflow Engine', memory.summary)),
  ];
}

async function engineeringInsights(context: ReturnType<typeof buildTerminalContext>): Promise<TerminalLine[]> {
  const snapshot = await getEngineeringMemorySnapshot(context.repository ? context.repoName : undefined);

  if (snapshot.insights.length === 0) {
    return [line('warning', 'Bob Intelligence', 'No engineering memory insights are available yet. Run memory-status first.')];
  }

  return [
    line('info', 'Bob Intelligence', 'Operational memory insights'),
    ...snapshot.insights.slice(0, 8).map((insight) => line('success', 'Bob Intelligence', insight)),
  ];
}

function showAgents(): TerminalLine[] {
  return [
    line('info', 'Agent Network', 'Specialized operational agents'),
    line('success', 'Workflow Engine', 'Workflow Intelligence Agent: CI/CD monitoring and instability detection'),
    line('success', 'Regression Engine', 'Regression Detection Agent: suspicious commits, scoring, propagation'),
    line('success', 'Architecture Analyzer', 'Repository Intelligence Agent: architecture, hotspots, dependencies'),
    line('success', 'Recovery Engine', 'Recovery Agent: remediation planning, stabilization validation'),
    line('success', 'Bob Intelligence', 'Documentation Agent: summaries, incident reports, operational explanations'),
  ];
}

function activeInvestigations(context: ReturnType<typeof buildTerminalContext>): TerminalLine[] {
  const activeRuns = context.recentCoordinationRuns.filter((run) => run.status !== 'COMPLETED');

  return [
    line('info', 'Agent Network', 'Active investigation ownership'),
    activeRuns.length
      ? line('warning', 'Agent Network', `${activeRuns.length} active coordination run(s)`)
      : line('success', 'Agent Network', 'No active coordination run is currently blocked.'),
    ...context.recentRecoveries.slice(0, 3).map((recovery) => line('info', 'Recovery Engine', `${recovery.workflowName || 'workflow'}: ${recovery.status} via ${recovery.strategy}`)),
  ];
}

function coordinationStatus(context: ReturnType<typeof buildTerminalContext>): TerminalLine[] {
  const latest = context.recentCoordinationRuns[0];
  if (!latest) {
    return [line('warning', 'Agent Network', 'No coordination run has been recorded yet. Run assign-analysis.')];
  }

  return [
    line('info', 'Agent Network', `Latest coordination: ${latest.status} priority=${latest.priority}`),
    line('success', 'Agent Network', latest.operationalSummary || 'Operational summary pending.'),
    line('success', 'Bob Intelligence', latest.combinedConclusion || 'Combined conclusion pending.'),
  ];
}

async function assignAnalysis(context: ReturnType<typeof buildTerminalContext>): Promise<TerminalLine[]> {
  const run = await runAgentCoordination({
    repository: context.repoName,
    triggerType: 'terminal',
    workflowName: 'Deploy and Test',
  });

  return [
    line('info', 'Agent Network', '[Workflow Agent] CI/CD signal ownership assigned...'),
    line('info', 'Regression Engine', '[Regression Agent] Regression and suspicious commit analysis assigned...'),
    line('info', 'Architecture Analyzer', '[Repository Agent] Module and memory graph mapping assigned...'),
    line('info', 'Recovery Engine', '[Recovery Agent] Remediation posture assigned...'),
    line('success', 'Bob Intelligence', `[Documentation Agent] ${run.combinedConclusion || 'Coordination report completed.'}`),
  ];
}

async function engineeringNetwork(context: ReturnType<typeof buildTerminalContext>): Promise<TerminalLine[]> {
  const snapshot = await getEngineeringMemorySnapshot(context.repository ? context.repoName : undefined);
  return [
    line('info', 'Agent Network', `Engineering network for ${snapshot.repository}`),
    line('success', 'Knowledge Graph', `${snapshot.stats.nodeCount} node(s), ${snapshot.stats.edgeCount} edge(s), ${snapshot.stats.memoryCount} memory record(s)`),
    line('success', 'Agent Network', `${context.recentCoordinationRuns.length} recent coordination run(s)`),
  ];
}

function investigationFlow(context: ReturnType<typeof buildTerminalContext>): TerminalLine[] {
  const latest = context.recentCoordinationRuns[0];
  return [
    line('info', 'Workflow Engine', '[Workflow Agent] CI failure detected...'),
    line('info', 'Regression Engine', '[Regression Agent] Correlating suspicious commits...'),
    line('info', 'Architecture Analyzer', '[Repository Agent] Mapping affected modules...'),
    line('info', 'Recovery Engine', '[Recovery Agent] Evaluating remediation strategy...'),
    line('success', 'Bob Intelligence', `[Documentation Agent] ${latest?.combinedConclusion || 'Ready to generate engineering report.'}`),
  ];
}

async function repositoryIntelligenceCommand(
  command: string,
  args: string[],
  context: ReturnType<typeof buildTerminalContext>
): Promise<TerminalLine[]> {
  if (!context.userId) {
    return [line('danger', 'AgenticRepo', 'Authenticated user context is required for repository intelligence.')];
  }

  try {
    const intelligence = await analyzeConnectedRepository(context.userId);

    if (command === 'repo-map') {
      return [
        line('info', 'AgenticRepo', `Repository map generated for ${intelligence.repository}`),
        line('success', 'GitHub', `${intelligence.modules.length} module area(s), ${intelligence.workflows.length} workflow(s), ${intelligence.hotspots.length} hotspot(s)`),
        ...intelligence.modules.slice(0, 8).map((module) => line(
          module.risk === 'high' ? 'warning' : 'success',
          'AgenticRepo',
          `${module.name}: ${module.files} files :: ${module.responsibilities.join(', ')}`
        )),
      ];
    }

    if (command === 'detect-hotspots') {
      return [
        line('info', 'AgenticRepo', 'Detecting repository hotspots from incidents, investigations, and workflow evidence...'),
        ...intelligence.hotspots.map((hotspot) => line(
          hotspot.score >= 50 ? 'danger' : 'warning',
          'Regression Engine',
          `${hotspot.path} score=${hotspot.score} reasons=${hotspot.reasons.join(', ')}`
        )),
      ];
    }

    if (command === 'generate-architecture-docs') {
      return [
        line('info', 'Bob Intelligence', 'Generating architecture documentation from repository intelligence...'),
        ...intelligence.generatedDocs.split('\n').filter(Boolean).slice(0, 18).map((text) => line('success', 'Bob Intelligence', text)),
      ];
    }

    if (command === 'explain-module') {
      const moduleName = args[0];
      const selected = intelligence.modules.find((module) => module.name === moduleName) || intelligence.modules[0];

      if (!selected) {
        return [line('warning', 'AgenticRepo', 'No module could be selected for explanation.')];
      }

      return [
        line('info', 'Bob Intelligence', `Explaining module ${selected.name}...`),
        line('success', 'AgenticRepo', `${selected.name} owns ${selected.files} mapped files and is classified as ${selected.risk} risk.`),
        line('success', 'Bob Intelligence', `Responsibilities: ${selected.responsibilities.join(', ')}`),
      ];
    }

    return [
      line('info', 'Bob Intelligence', 'Architecture summary generated from repository structure and operational evidence.'),
      line('success', 'AgenticRepo', intelligence.summary),
      ...intelligence.patterns.map((pattern) => line('success', 'AgenticRepo', pattern)),
      ...intelligence.risks.map((risk) => line('warning', 'Regression Engine', risk)),
    ];
  } catch (error) {
    return [
      line('danger', 'GitHub', error instanceof Error ? error.message : 'Repository intelligence failed.'),
    ];
  }
}

function formatEvents(events: GithubEvent[]): TerminalLine[] {
  if (events.length === 0) {
    return [line('warning', 'Workflow Engine', 'No GitHub workflow events recorded yet.')];
  }

  return events.map((event) => line('success', 'Workflow Engine', `${event.eventType} :: ${event.createdAt.toISOString()}`));
}

function line(tone: TerminalTone, badge: TerminalBadge, text: string): TerminalLine {
  return {
    tone,
    badge,
    text,
    timestamp: new Date().toISOString(),
  };
}

function parseJsonArray(value: string | null): string[] {
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
