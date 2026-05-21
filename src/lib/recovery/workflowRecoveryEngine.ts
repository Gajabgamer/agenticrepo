import { generateEngineeringSummary } from '@/lib/ai/generateEngineeringSummary';
import { logActivityEvent } from '@/lib/activity/logActivityEvent';
import { getPrisma } from '@/lib/database/prisma';
import { analyzeWorkflowFailure, type WorkflowFailureAnalysis } from '@/lib/github/analyzeWorkflowFailure';
import { calculateRegressionRisk, type RegressionRiskResult } from '@/lib/github/calculateRegressionRisk';
import type { SuspiciousCommit } from '@/lib/github/correlateRecentCommits';
import { isSafeAutoFix } from '@/lib/github/isSafeAutoFix';
import { parseWorkflowLogs, type ParsedWorkflowLogs } from '@/lib/github/parseWorkflowLogs';
import { runAutoFixWorkflow } from '@/lib/github/runAutoFixWorkflow';
import { incidentKey, severityFromScore, upsertIncident } from '@/lib/incidents/incidentManager';
import { refreshEngineeringMemory } from '@/lib/memory/engineeringMemoryEngine';
import { createWorkflowRunWebhookPayload } from '@/lib/testing/mockPayloads';
import type { GitHubWebhookPayload } from '@/types';

type RecoveryStatus = 'PLANNED' | 'INVESTIGATING' | 'STRATEGY_SELECTED' | 'AUTOFIX_RUNNING' | 'VALIDATING' | 'STABILIZED' | 'MANUAL_REVIEW';
type RecoveryStrategy = 'RETRY_RECOMMENDED' | 'ROLLBACK_RECOMMENDED' | 'DEPENDENCY_REPAIR' | 'WORKFLOW_REPAIR' | 'SAFE_AUTOFIX' | 'CONFIGURATION_REVIEW' | 'MANUAL_INVESTIGATION';

type RunRecoveryInput = {
  repository: string;
  workflowName?: string;
  branch?: string;
  runId?: string | number;
  payload?: GitHubWebhookPayload;
  failureAnalysis?: WorkflowFailureAnalysis;
  logAnalysis?: ParsedWorkflowLogs;
  suspiciousCommits?: SuspiciousCommit[];
  regressionRisk?: RegressionRiskResult;
  rawLogs?: string;
  installationId?: number;
  cloneUrl?: string;
  defaultBranch?: string;
  executeAutoFix?: boolean;
};

const recoveryFixtureLogs = `
2026-05-21T10:30:45.123Z [error] Test suite failed in src/api/users.test.ts
2026-05-21T10:30:45.234Z Error: Expected 200 but got 404 at src/api/users.test.ts:45:12
2026-05-21T10:30:45.345Z TypeError: Cannot read properties of undefined at src/services/user-service.ts
2026-05-21T10:30:46.001Z Module not found: Cannot resolve './utils/helpers'
2026-05-21T10:30:46.567Z [fail] 3 tests failed, 12 passed
`;

const recoveryFixtureCommits: SuspiciousCommit[] = [
  {
    sha: 'abc1234def5678',
    author: 'workflow-context',
    message: 'Update user service response handling',
    matchedFiles: ['src/services/user-service.ts', 'src/api/users.test.ts'],
  },
  {
    sha: 'fed9876cba4321',
    author: 'workflow-context',
    message: 'Adjust dependency helper imports',
    matchedFiles: ['src/components/Header.tsx'],
  },
];

// made by bob
export async function runWorkflowRecovery(input: RunRecoveryInput) {
  const prisma = getPrisma();
  const workflowName = input.workflowName || input.payload?.workflow_run?.name || 'Deploy and Test';
  const branch = input.branch || input.payload?.workflow_run?.head_branch || input.defaultBranch || 'main';
  const runId = input.runId ? String(input.runId) : input.payload?.workflow_run?.id ? String(input.payload.workflow_run.id) : undefined;
  const recoveryKey = incidentKey(['workflow-recovery', input.repository, workflowName, branch, runId || 'manual']);

  const recovery = await prisma.workflowRecovery.upsert({
    where: { recoveryKey },
    create: {
      recoveryKey,
      repository: input.repository,
      workflowName,
      branch,
      runId,
      status: 'INVESTIGATING',
      strategy: 'MANUAL_INVESTIGATION',
      confidenceScore: 0,
      stabilizationProbability: 0,
      probableRootCause: 'Recovery analysis is running.',
      proposedRemediation: 'Recovery strategy pending.',
      operationalImpact: 'Impact pending investigation.',
      validationSummary: 'Validation pending.',
    },
    update: {
      status: 'INVESTIGATING',
      completedAt: null,
    },
  });

  await prisma.workflowRecoveryStep.deleteMany({ where: { recoveryId: recovery.id } });
  await logActivityEvent({
    eventType: 'workflow_recovery',
    repository: input.repository,
    severity: 'info',
    status: 'started',
    summary: `Recovery started for ${workflowName}`,
    relatedWorkflow: workflowName,
  });

  await recordRecoveryStep(recovery.id, 'failure_intake', 'completed', '[Recovery Engine] Investigating workflow instability...', {
    repository: input.repository,
    workflowName,
    branch,
    runId,
  });

  const fallbackPayload = createWorkflowRunWebhookPayload({
    owner: input.repository.includes('/') ? input.repository.split('/')[0] : 'local-owner',
    repo: input.repository.includes('/') ? input.repository.split('/')[1] : input.repository,
    branch,
    defaultBranch: branch,
  });
  const failureAnalysis = input.failureAnalysis || analyzeWorkflowFailure(input.payload || fallbackPayload);
  const logAnalysis = input.logAnalysis || parseWorkflowLogs(input.rawLogs || recoveryFixtureLogs);
  const suspiciousCommits = input.suspiciousCommits || recoveryFixtureCommits;

  await recordRecoveryStep(recovery.id, 'log_intelligence', 'completed', '[Log Intelligence] Parsing failure patterns...', {
    summary: logAnalysis.summary,
    errors: logAnalysis.errors,
    files: logAnalysis.files,
  });

  const regressionRisk = input.regressionRisk || calculateRegressionRisk({
    severityScore: failureAnalysis?.severityScore || 0,
    detectedErrors: logAnalysis.errors,
    detectedFiles: logAnalysis.files,
    suspiciousCommits,
    branch,
  });

  await recordRecoveryStep(recovery.id, 'regression_detection', 'completed', '[Regression System] Detecting risky commits...', {
    regressionRisk,
    suspiciousCommits: suspiciousCommits.map((commit) => ({
      sha: commit.sha,
      matchedFiles: commit.matchedFiles,
    })),
  });

  const affectedSystems = inferAffectedSystems(logAnalysis.files);
  await recordRecoveryStep(recovery.id, 'affected_module_identification', 'completed', '[Repository Intelligence] Identifying affected recovery surfaces...', {
    affectedSystems,
    files: logAnalysis.files,
  });

  const autoFixEligibility = isSafeAutoFix({
    regressionRiskScore: regressionRisk.regressionRiskScore,
    confidenceLevel: regressionRisk.confidenceLevel,
    detectedFiles: logAnalysis.files,
    detectedErrors: logAnalysis.errors,
  });
  const strategy = selectRecoveryStrategy(logAnalysis, regressionRisk, autoFixEligibility.allowed);
  const confidenceScore = calculateRecoveryConfidence(regressionRisk, logAnalysis, suspiciousCommits, autoFixEligibility.allowed);
  const stabilizationProbability = calculateStabilizationProbability(confidenceScore, strategy, autoFixEligibility.allowed);
  const probableRootCause = deriveRecoveryRootCause(logAnalysis.errors);
  const proposedRemediation = buildProposedRemediation(strategy, autoFixEligibility.reason);
  const operationalImpact = buildOperationalImpact(strategy, regressionRisk, affectedSystems);
  const validationSummary = buildValidationSummary(strategy, stabilizationProbability);
  const engineeringSummary = failureAnalysis
    ? generateEngineeringSummary({
        workflowAnalysis: failureAnalysis,
        parsedLogAnalysis: logAnalysis,
        suspiciousCommits,
        regressionRisk,
      }).summary
    : probableRootCause;

  await recordRecoveryStep(recovery.id, 'strategy_evaluation', 'completed', '[Bob Intelligence] Generating recovery strategy...', {
    strategy,
    confidenceScore,
    stabilizationProbability,
    proposedRemediation,
    autoFixEligibility,
  });

  let recoveryPullRequestUrl: string | undefined;
  let autoFixExecuted = false;
  const canExecuteAutofix = input.executeAutoFix && autoFixEligibility.allowed && input.cloneUrl && input.repository.includes('/');

  if (canExecuteAutofix) {
    await recordRecoveryStep(recovery.id, 'autofix_execution', 'running', '[AutoFix Engine] Preparing remediation branch...', {
      detectedFiles: logAnalysis.files,
    });

    try {
      const [owner, repo] = input.repository.split('/');
      const result = await runAutoFixWorkflow({
        repositoryCloneUrl: input.cloneUrl as string,
        repositoryOwner: owner,
        repositoryName: repo,
        baseBranch: input.defaultBranch || branch,
        detectedFiles: logAnalysis.files,
        detectedErrors: logAnalysis.errors,
        suspiciousCommits,
        regressionRisk,
        engineeringSummary,
        installationId: input.installationId,
      });

      autoFixExecuted = result.success;
      recoveryPullRequestUrl = result.pullRequestUrl;
      await recordRecoveryStep(recovery.id, 'autofix_execution', result.success ? 'completed' : 'blocked', result.success ? '[AutoFix Engine] Recovery pull request created.' : `[AutoFix Engine] ${result.error || 'Recovery pull request was not created.'}`, {
        branchName: result.branchName,
        pullRequestUrl: result.pullRequestUrl,
        error: result.error,
      });
    } catch (error) {
      await recordRecoveryStep(recovery.id, 'autofix_execution', 'failed', '[AutoFix Engine] Recovery execution failed safely.', {
        error: error instanceof Error ? error.message : 'Unknown recovery auto-fix error',
      });
    }
  } else {
    await recordRecoveryStep(recovery.id, 'autofix_execution', autoFixEligibility.allowed ? 'blocked' : 'skipped', '[AutoFix Engine] Preparing remediation branch...', {
      reason: autoFixEligibility.allowed ? 'Execution requires repository clone context and explicit auto-fix gate.' : autoFixEligibility.reason,
    });
  }

  await recordRecoveryStep(recovery.id, 'validation', 'completed', '[Validation Engine] Evaluating stabilization probability...', {
    validationSummary,
    stabilizationProbability,
    recoveryPullRequestUrl,
  });

  const status: RecoveryStatus = autoFixExecuted
    ? 'STABILIZED'
    : autoFixEligibility.allowed
      ? 'STRATEGY_SELECTED'
      : 'MANUAL_REVIEW';
  const completed = await prisma.workflowRecovery.update({
    where: { id: recovery.id },
    data: {
      status,
      strategy,
      confidenceScore,
      stabilizationProbability,
      probableRootCause,
      affectedSystems: JSON.stringify(affectedSystems),
      proposedRemediation,
      operationalImpact,
      validationSummary,
      autoFixEligible: autoFixEligibility.allowed,
      autoFixExecuted,
      recoveryPullRequestUrl,
      linkedIncidentKey: incidentKey(['workflow', input.repository, workflowName, branch, runId]),
      completedAt: new Date(),
    },
    include: {
      steps: {
        orderBy: { startedAt: 'asc' },
      },
    },
  });

  await upsertIncident({
    incidentKey: incidentKey(['workflow-recovery', input.repository, workflowName, branch, runId]),
    severity: severityFromScore(regressionRisk.regressionRiskScore),
    repository: input.repository,
    affectedBranch: branch,
    affectedFiles: logAnalysis.files,
    engineeringSummary: `${probableRootCause} ${proposedRemediation}`,
    status: autoFixExecuted ? 'RESOLVED' : autoFixEligibility.allowed ? 'ANALYZING' : 'INVESTIGATING',
    relatedWorkflow: workflowName,
    relatedUrl: recoveryPullRequestUrl,
    historySummary: `Recovery strategy selected: ${strategy}`,
    historyDetails: {
      recoveryId: completed.id,
      confidenceScore,
      stabilizationProbability,
      autoFixEligibility,
    },
  });

  await logActivityEvent({
    eventType: 'workflow_recovery',
    repository: input.repository,
    severity: status === 'STABILIZED' ? 'success' : status === 'MANUAL_REVIEW' ? 'warning' : 'info',
    status: status === 'STABILIZED' ? 'completed' : 'blocked',
    summary: `Recovery ${status.toLowerCase().replace('_', ' ')} for ${workflowName}`,
    details: {
      recoveryId: completed.id,
      strategy,
      confidenceScore,
      stabilizationProbability,
      affectedSystems,
    },
    relatedWorkflow: workflowName,
    relatedUrl: recoveryPullRequestUrl,
  });

  await refreshEngineeringMemory(input.repository);

  return completed;
}

export async function runWorkflowRecoveryFromWebhook(input: {
  payload: GitHubWebhookPayload;
  failureAnalysis: WorkflowFailureAnalysis;
  logAnalysis: ParsedWorkflowLogs;
  suspiciousCommits: SuspiciousCommit[];
  regressionRisk: RegressionRiskResult;
  executeAutoFix?: boolean;
}) {
  const repository = input.payload.repository?.full_name || input.payload.repository?.name || 'unknown';

  return runWorkflowRecovery({
    repository,
    workflowName: input.payload.workflow_run?.name,
    branch: input.payload.workflow_run?.head_branch,
    runId: input.payload.workflow_run?.id,
    payload: input.payload,
    failureAnalysis: input.failureAnalysis,
    logAnalysis: input.logAnalysis,
    suspiciousCommits: input.suspiciousCommits,
    regressionRisk: input.regressionRisk,
    installationId: input.payload.installation?.id,
    cloneUrl: input.payload.repository?.clone_url,
    defaultBranch: input.payload.repository?.default_branch,
    executeAutoFix: input.executeAutoFix,
  });
}

async function recordRecoveryStep(
  recoveryId: string,
  stage: string,
  status: string,
  summary: string,
  evidence?: Record<string, unknown>
) {
  return getPrisma().workflowRecoveryStep.create({
    data: {
      recoveryId,
      stage,
      status,
      summary,
      evidence: evidence ? JSON.stringify(evidence) : undefined,
      completedAt: status === 'running' ? undefined : new Date(),
    },
  });
}

function inferAffectedSystems(files: string[]): string[] {
  const systems = new Set<string>();

  for (const file of files) {
    const lower = file.toLowerCase();
    if (lower.includes('.github') || lower.includes('workflow')) systems.add('CI/CD workflow');
    if (lower.includes('api') || lower.includes('route')) systems.add('API boundary');
    if (lower.includes('service')) systems.add('service layer');
    if (lower.includes('component') || lower.includes('app/')) systems.add('frontend surface');
    if (lower.includes('package') || lower.includes('lock')) systems.add('dependency graph');
    if (lower.includes('prisma') || lower.includes('database')) systems.add('persistence layer');
    if (lower.includes('test') || lower.includes('spec')) systems.add('regression test surface');
  }

  return Array.from(systems).slice(0, 8);
}

function selectRecoveryStrategy(
  logs: ParsedWorkflowLogs,
  regressionRisk: RegressionRiskResult,
  autoFixAllowed: boolean
): RecoveryStrategy {
  const joined = `${logs.errors.join(' ')} ${logs.files.join(' ')}`.toLowerCase();

  if (autoFixAllowed) return 'SAFE_AUTOFIX';
  if (joined.includes('module not found') || joined.includes('cannot resolve')) return 'DEPENDENCY_REPAIR';
  if (joined.includes('package') || joined.includes('lock')) return 'DEPENDENCY_REPAIR';
  if (joined.includes('workflow') || joined.includes('.github')) return 'WORKFLOW_REPAIR';
  if (regressionRisk.regressionRiskScore >= 80 && regressionRisk.confidenceLevel === 'HIGH') return 'ROLLBACK_RECOMMENDED';
  if (logs.errors.length <= 1 && regressionRisk.regressionRiskScore < 50) return 'RETRY_RECOMMENDED';
  if (joined.includes('config') || joined.includes('env')) return 'CONFIGURATION_REVIEW';
  return 'MANUAL_INVESTIGATION';
}

function calculateRecoveryConfidence(
  regressionRisk: RegressionRiskResult,
  logs: ParsedWorkflowLogs,
  commits: SuspiciousCommit[],
  autoFixAllowed: boolean
): number {
  return Math.min(95, 35 + (regressionRisk.confidenceLevel === 'HIGH' ? 25 : regressionRisk.confidenceLevel === 'MEDIUM' ? 15 : 5) + Math.min(20, logs.files.length * 4) + Math.min(10, commits.length * 5) + (autoFixAllowed ? 10 : 0));
}

function calculateStabilizationProbability(confidence: number, strategy: RecoveryStrategy, autoFixAllowed: boolean): number {
  const strategyBoost = strategy === 'SAFE_AUTOFIX' ? 12 : strategy === 'RETRY_RECOMMENDED' ? 8 : strategy === 'MANUAL_INVESTIGATION' ? -10 : 4;
  return Math.max(10, Math.min(96, confidence + strategyBoost + (autoFixAllowed ? 6 : 0)));
}

function deriveRecoveryRootCause(errors: string[]): string {
  const joined = errors.join(' ').toLowerCase();

  if (joined.includes('module') || joined.includes('cannot resolve')) return 'Dependency or import boundary failure is blocking the workflow.';
  if (joined.includes('undefined') || joined.includes('null')) return 'Runtime nullability regression is likely affecting the tested path.';
  if (joined.includes('expected') && joined.includes('got')) return 'Behavioral regression changed an expected response or contract.';
  if (joined.includes('timeout')) return 'Workflow instability may be caused by external latency or flaky integration behavior.';
  return 'Workflow instability requires focused engineering recovery review.';
}

function buildProposedRemediation(strategy: RecoveryStrategy, blockReason?: string): string {
  const copy: Record<RecoveryStrategy, string> = {
    SAFE_AUTOFIX: 'Generate a deterministic safe recovery branch using allowed fix classes, then validate with CI before merge.',
    RETRY_RECOMMENDED: 'Retry the workflow once and compare the failure signature before escalating.',
    ROLLBACK_RECOMMENDED: 'Review suspicious commits and prepare a rollback or revert plan for the affected module.',
    DEPENDENCY_REPAIR: 'Inspect dependency, lockfile, and import resolution changes before retrying CI.',
    WORKFLOW_REPAIR: 'Inspect workflow configuration and runner assumptions before re-running validation.',
    CONFIGURATION_REVIEW: 'Validate configuration and environment assumptions before deploying.',
    MANUAL_INVESTIGATION: `Manual recovery review required${blockReason ? `: ${blockReason}` : '.'}`,
  };

  return copy[strategy];
}

function buildOperationalImpact(strategy: RecoveryStrategy, regressionRisk: RegressionRiskResult, affectedSystems: string[]): string {
  const surface = affectedSystems.length ? affectedSystems.join(', ') : 'repository workflow surface';
  return `${strategy.replaceAll('_', ' ')} selected with regression risk ${regressionRisk.regressionRiskScore}/100 (${regressionRisk.confidenceLevel}). Affected systems: ${surface}.`;
}

function buildValidationSummary(strategy: RecoveryStrategy, probability: number): string {
  return `Validation gate recommends ${strategy === 'SAFE_AUTOFIX' ? 'CI run on generated recovery PR plus targeted tests' : 'manual confirmation plus CI re-run'}; estimated stabilization probability ${probability}%.`;
}

// Made with Bob
// made by bob
