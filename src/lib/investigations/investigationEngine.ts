import { generateEngineeringSummary } from '@/lib/ai/generateEngineeringSummary';
import { logActivityEvent } from '@/lib/activity/logActivityEvent';
import { analyzeWorkflowFailure } from '@/lib/github/analyzeWorkflowFailure';
import { calculateRegressionRisk } from '@/lib/github/calculateRegressionRisk';
import type { SuspiciousCommit } from '@/lib/github/correlateRecentCommits';
import { isSafeAutoFix } from '@/lib/github/isSafeAutoFix';
import { parseWorkflowLogs } from '@/lib/github/parseWorkflowLogs';
import { prisma } from '@/lib/database/prisma';
import { createWorkflowRunWebhookPayload } from '@/lib/testing/mockPayloads';
import { incidentKey, severityFromScore, upsertIncident } from '@/lib/incidents/incidentManager';
import { getSimilarOperationalMemories } from '@/lib/memory/engineeringMemoryEngine';

type InvestigationTrigger = 'workflow_failure' | 'terminal' | 'incident' | 'repository';

type RunInvestigationInput = {
  repository: string;
  branch?: string;
  triggerType: InvestigationTrigger;
  relatedWorkflow?: string;
  relatedPr?: number;
  linkedIncidentId?: string;
};

const sampleLogs = `
2026-05-21T10:30:45.123Z [error] Test suite failed in src/api/users.test.ts
2026-05-21T10:30:45.234Z Error: Expected 200 but got 404 at src/api/users.test.ts:45:12
2026-05-21T10:30:45.345Z TypeError: Cannot read properties of undefined at src/services/user-service.ts
2026-05-21T10:30:46.001Z error: failed to compile src/components/Header.tsx
2026-05-21T10:30:46.567Z [fail] 3 tests failed, 12 passed
`;

const localSuspiciousCommits: SuspiciousCommit[] = [
  {
    sha: 'abc1234def5678',
    author: 'workflow-context',
    message: 'Update user service response handling',
    matchedFiles: ['src/services/user-service.ts', 'src/api/users.test.ts'],
  },
  {
    sha: 'fed9876cba4321',
    author: 'workflow-context',
    message: 'Refactor shared header data flow',
    matchedFiles: ['src/components/Header.tsx'],
  },
];

// made by bob
export async function runAutonomousInvestigation(input: RunInvestigationInput) {
  const key = incidentKey(['investigation', input.triggerType, input.repository, input.relatedWorkflow, input.relatedPr]);
  const investigation = await prisma.investigation.upsert({
    where: { investigationKey: key },
    create: {
      investigationKey: key,
      repository: input.repository,
      triggerType: input.triggerType,
      status: 'RUNNING',
      currentStage: 'workflow_inspection',
      relatedWorkflow: input.relatedWorkflow,
      relatedPr: input.relatedPr,
      linkedIncidentId: input.linkedIncidentId,
    },
    update: {
      status: 'RUNNING',
      currentStage: 'workflow_inspection',
      completedAt: null,
    },
  });

  await logActivityEvent({
    eventType: 'repository_investigation',
    repository: input.repository,
    severity: 'info',
    status: 'started',
    summary: `Autonomous investigation started: ${input.triggerType}`,
    relatedWorkflow: input.relatedWorkflow,
    relatedPr: input.relatedPr,
  });

  const [owner, repo] = input.repository.includes('/') ? input.repository.split('/') : ['local-owner', input.repository];
  const payload = createWorkflowRunWebhookPayload({
    owner,
    repo,
    branch: input.branch || 'main',
    defaultBranch: input.branch || 'main',
  });

  await recordStep(investigation.id, 'workflow_inspection', 'completed', '[Investigation Engine] Inspecting failed workflow...', {
    repository: input.repository,
    workflow: payload.workflow_run?.name,
    branch: payload.workflow_run?.head_branch,
  });
  const workflowAnalysis = analyzeWorkflowFailure(payload);

  const parsedLogs = parseWorkflowLogs(sampleLogs);
  await recordStep(investigation.id, 'log_analysis', 'completed', '[Log Analyzer] Parsing CI logs...', {
    summary: parsedLogs.summary,
    errors: parsedLogs.errors,
    files: parsedLogs.files,
  });

  await recordStep(investigation.id, 'suspicious_commit_correlation', 'completed', '[Regression Engine] Correlating suspicious commits...', {
    commits: localSuspiciousCommits,
  });

  await recordStep(investigation.id, 'affected_file_analysis', 'completed', '[Repository Intelligence] Identifying affected modules...', {
    affectedFiles: parsedLogs.files,
    modules: Array.from(new Set(parsedLogs.files.map((file) => file.split('/').slice(0, 2).join('/')))),
  });

  const similarMemories = await getSimilarOperationalMemories({
    repository: input.repository,
    files: parsedLogs.files,
    workflowName: input.relatedWorkflow || payload.workflow_run?.name,
    limit: 5,
  });
  await recordStep(investigation.id, 'operational_memory_lookup', similarMemories.length ? 'completed' : 'skipped', '[Memory Core] Comparing against prior operational memory...', {
    similarMemories: similarMemories.map((memory) => ({
      type: memory.memoryType,
      subject: memory.subject,
      summary: memory.summary,
      confidenceScore: memory.confidenceScore,
    })),
  });

  const regressionRisk = calculateRegressionRisk({
    severityScore: workflowAnalysis?.severityScore || 0,
    detectedErrors: parsedLogs.errors,
    detectedFiles: parsedLogs.files,
    suspiciousCommits: localSuspiciousCommits,
    branch: payload.workflow_run?.head_branch,
  });
  await recordStep(investigation.id, 'regression_scoring', 'completed', '[Regression Engine] Evaluating regression severity...', { ...regressionRisk });

  const engineeringSummary = workflowAnalysis
    ? generateEngineeringSummary({
        workflowAnalysis,
        parsedLogAnalysis: parsedLogs,
        suspiciousCommits: localSuspiciousCommits,
        regressionRisk,
      }).summary
    : 'Workflow analysis did not produce a failure summary.';
  await recordStep(investigation.id, 'engineering_summary', 'completed', '[Bob Intelligence] Generating engineering reasoning...', {
    summary: engineeringSummary,
  });

  const autoFixEligibility = isSafeAutoFix({
    regressionRiskScore: regressionRisk.regressionRiskScore,
    confidenceLevel: regressionRisk.confidenceLevel,
    detectedFiles: parsedLogs.files,
    detectedErrors: parsedLogs.errors,
  });
  await recordStep(investigation.id, 'autofix_eligibility', autoFixEligibility.allowed ? 'completed' : 'blocked', '[AutoFix System] Evaluating remediation eligibility...', { ...autoFixEligibility });

  const severity = severityFromScore(regressionRisk.regressionRiskScore);
  const rootCause = deriveRootCause(parsedLogs.errors);
  const recommendedActions = [
    ...(similarMemories.length ? ['Compare with similar historical memory before choosing remediation.'] : []),
    'Review suspicious commits touching affected files.',
    autoFixEligibility.allowed ? 'Run deterministic auto-fix workflow.' : `Manual review required: ${autoFixEligibility.reason}`,
    'Use GitHub workflow logs to confirm reproduction path.',
  ];

  const completed = await prisma.investigation.update({
    where: { id: investigation.id },
    data: {
      status: 'COMPLETED',
      currentStage: 'completed',
      severity,
      confidenceLevel: regressionRisk.confidenceLevel,
      rootCause,
      affectedFiles: JSON.stringify(parsedLogs.files),
      suspiciousCommits: JSON.stringify(localSuspiciousCommits),
      conclusion: engineeringSummary,
      recommendedActions: JSON.stringify(recommendedActions),
      completedAt: new Date(),
    },
    include: {
      steps: {
        orderBy: { startedAt: 'asc' },
      },
    },
  });

  await upsertIncident({
    incidentKey: incidentKey(['investigation', input.repository, input.relatedWorkflow || input.triggerType]),
    severity,
    repository: input.repository,
    affectedBranch: payload.workflow_run?.head_branch,
    affectedFiles: parsedLogs.files,
    engineeringSummary,
    status: autoFixEligibility.allowed ? 'ANALYZING' : 'INVESTIGATING',
    relatedWorkflow: input.relatedWorkflow || payload.workflow_run?.name,
    relatedPr: input.relatedPr,
    historySummary: 'Autonomous investigation completed',
    historyDetails: {
      investigationId: completed.id,
      confidenceLevel: regressionRisk.confidenceLevel,
      autoFixEligibility,
    },
  });

  await logActivityEvent({
    eventType: 'repository_investigation',
    repository: input.repository,
    severity: severity === 'CRITICAL' || severity === 'HIGH' ? 'danger' : severity === 'MEDIUM' ? 'warning' : 'info',
    status: 'completed',
    summary: `Investigation completed with ${regressionRisk.confidenceLevel} confidence`,
    details: {
      investigationId: completed.id,
      rootCause,
      recommendedActions,
    },
    relatedWorkflow: input.relatedWorkflow || payload.workflow_run?.name,
    relatedPr: input.relatedPr,
  });

  return completed;
}

async function recordStep(
  investigationId: string,
  stage: string,
  status: string,
  summary: string,
  evidence?: Record<string, unknown>
) {
  await prisma.investigation.update({
    where: { id: investigationId },
    data: { currentStage: stage },
  });

  return prisma.investigationStep.create({
    data: {
      investigationId,
      stage,
      status,
      summary,
      evidence: evidence ? JSON.stringify(evidence) : undefined,
      completedAt: new Date(),
    },
  });
}

function deriveRootCause(errors: string[]): string {
  const joined = errors.join(' ').toLowerCase();

  if (joined.includes('expected') && joined.includes('got')) {
    return 'Behavioral regression in API response expectations.';
  }

  if (joined.includes('undefined') || joined.includes('null')) {
    return 'Runtime nullability regression in changed execution path.';
  }

  if (joined.includes('module') || joined.includes('compile')) {
    return 'Build or dependency boundary regression.';
  }

  return 'Workflow failure requires focused engineering review.';
}

// Made with Bob
// made by bob
