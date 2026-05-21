import { generateCodeFix } from '@/lib/ai/generateCodeFix';
import { generateEngineeringSummary } from '@/lib/ai/generateEngineeringSummary';
import { runAgentCoordination } from '@/lib/agents/coordinationEngine';
import { analyzeWorkflowFailure } from '@/lib/github/analyzeWorkflowFailure';
import { calculateRegressionRisk } from '@/lib/github/calculateRegressionRisk';
import { SuspiciousCommit } from '@/lib/github/correlateRecentCommits';
import { generateFixPatch } from '@/lib/github/generateFixPatch';
import { isSafeAutoFix } from '@/lib/github/isSafeAutoFix';
import { parseWorkflowLogs } from '@/lib/github/parseWorkflowLogs';
import { incidentKey, severityFromScore, upsertIncident } from '@/lib/incidents/incidentManager';
import { runAutonomousInvestigation } from '@/lib/investigations/investigationEngine';
import { runWorkflowRecovery } from '@/lib/recovery/workflowRecoveryEngine';
import { GitHubWebhookPayload } from '@/types';
import { StructuredWorkflowLogger } from './structuredLogger';
import { createLocalWebhookFixtures, simulateWebhook } from './webhookSimulator';

interface LocalCommitFixture {
  sha: string;
  author: string;
  message: string;
  changedFiles: string[];
}

export interface LocalWorkflowSimulationResult {
  regressionRiskScore: number;
  confidenceLevel: string;
  suspiciousCommitCount: number;
  issueUrl: string;
  autoFixBranchName?: string;
  generatedFixCount: number;
}

const rawFailureLogs = `
2026-05-17T10:30:45.123Z [error] Test suite failed in src/api/users.test.ts
2026-05-17T10:30:45.234Z Error: Expected 200 but got 404 at src/api/users.test.ts:45:12
2026-05-17T10:30:45.345Z TypeError: Cannot read property 'id' of undefined at src/services/user-service.ts:123:20
2026-05-17T10:30:46.567Z [fail] Regression detected in src/services/user-service.ts
2026-05-17T10:30:47.890Z Compilation error in src/components/Header.tsx
2026-05-17T10:30:48.001Z Error: Request timeout in src/lib/http-client.ts
`;

const localCommitFixtures: LocalCommitFixture[] = [
  {
    sha: 'abc1234def5678',
    author: 'Local Developer',
    message: 'refactor: adjust user service response handling',
    changedFiles: ['src/services/user-service.ts', 'src/api/users.test.ts'],
  },
  {
    sha: 'fed9876cba4321',
    author: 'Local Developer',
    message: 'chore: update header copy',
    changedFiles: ['src/components/Header.tsx', 'src/lib/http-client.ts'],
  },
];

function correlateLocalCommits(
  commits: LocalCommitFixture[],
  detectedFiles: string[]
): SuspiciousCommit[] {
  return commits.flatMap((commit) => {
    const matchedFiles = commit.changedFiles.filter((changedFile) =>
      detectedFiles.some(
        (detectedFile) =>
          changedFile === detectedFile ||
          changedFile.endsWith(detectedFile) ||
          detectedFile.endsWith(changedFile)
      )
    );

    if (matchedFiles.length === 0) {
      return [];
    }

    return [{
      sha: commit.sha,
      author: commit.author,
      message: commit.message,
      matchedFiles,
    }];
  });
}

function createMockIssue(repository: string, title: string) {
  return {
    issueNumber: 1001,
    issueUrl: `https://github.local/${repository}/issues/1001`,
    title,
  };
}

async function simulateAutoFixWorkflow(
  detectedErrors: string[],
  detectedFiles: string[],
  suspiciousCommits: SuspiciousCommit[],
  engineeringSummary: string
) {
  const patchMetadata = generateFixPatch({
    detectedErrors,
    detectedFiles,
    suspiciousCommits,
  });

  const codeFixResult = await generateCodeFix({
    detectedErrors: ['expected ;'],
    detectedFiles: ['src/services/user-service.ts'],
    engineeringSummary,
    fileContents: [
      {
        path: 'src/services/user-service.ts',
        content: 'const status = 200\nconst body = { id: 1 }\n',
      },
    ],
  });

  return {
    branchName: patchMetadata.branchName,
    pullRequestTitle: patchMetadata.pullRequestTitle,
    updatedFiles: codeFixResult.updatedFiles,
  };
}

export async function runLocalWorkflowSimulation(): Promise<LocalWorkflowSimulationResult> {
  const logger = new StructuredWorkflowLogger();
  const fixtures = createLocalWebhookFixtures();
  const workflowPayload = fixtures.workflowRun as GitHubWebhookPayload;

  logger.log('simulation', 'start', 'Starting local end-to-end workflow execution test');

  await simulateWebhook('pull_request', fixtures.pullRequest, logger);
  await simulateWebhook('issue_comment', fixtures.issueComment, logger);

  logger.log('ci_failure', 'start', 'Analyzing failed workflow_run webhook', {
    workflowRunId: workflowPayload.workflow_run?.id,
  });
  const failureAnalysis = analyzeWorkflowFailure(workflowPayload);
  if (!failureAnalysis) {
    throw new Error('Expected workflow failure analysis to be generated');
  }
  logger.log('ci_failure', 'success', failureAnalysis.summary, {
    severityScore: failureAnalysis.severityScore,
  });
  await runAutonomousInvestigation({
    repository: workflowPayload.repository.full_name,
    branch: workflowPayload.workflow_run?.head_branch,
    triggerType: 'workflow_failure',
    relatedWorkflow: workflowPayload.workflow_run?.name,
  });

  logger.log('log_parsing', 'start', 'Parsing local CI failure logs');
  const parsedLogs = parseWorkflowLogs(rawFailureLogs);
  logger.log('log_parsing', 'success', parsedLogs.summary, {
    errors: parsedLogs.errors.length,
    files: parsedLogs.files,
  });

  logger.log('commit_correlation', 'start', 'Correlating detected files with local commit fixtures');
  const suspiciousCommits = correlateLocalCommits(localCommitFixtures, parsedLogs.files);
  logger.log('commit_correlation', 'success', 'Suspicious commit correlation completed', {
    suspiciousCommitCount: suspiciousCommits.length,
    shas: suspiciousCommits.map((commit) => commit.sha),
  });

  logger.log('regression_detection', 'start', 'Calculating regression risk score');
  const regressionRisk = calculateRegressionRisk({
    severityScore: failureAnalysis.severityScore,
    detectedErrors: parsedLogs.errors,
    detectedFiles: parsedLogs.files,
    suspiciousCommits,
    branch: workflowPayload.workflow_run?.head_branch,
  });
  logger.log('regression_detection', 'success', 'Regression risk calculated', {
    regressionRiskScore: regressionRisk.regressionRiskScore,
    confidenceLevel: regressionRisk.confidenceLevel,
  });
  await upsertIncident({
    incidentKey: incidentKey(['local-simulation', workflowPayload.repository.full_name, workflowPayload.workflow_run?.id]),
    severity: severityFromScore(regressionRisk.regressionRiskScore),
    repository: workflowPayload.repository.full_name,
    affectedBranch: workflowPayload.workflow_run?.head_branch,
    affectedFiles: parsedLogs.files,
    engineeringSummary: `Local workflow simulation detected regression risk ${regressionRisk.regressionRiskScore}/100`,
    status: 'ANALYZING',
    relatedWorkflow: workflowPayload.workflow_run?.name,
    historySummary: 'Local end-to-end workflow simulation opened incident',
    historyDetails: {
      suspiciousCommits: suspiciousCommits.map((commit) => commit.sha),
      confidenceLevel: regressionRisk.confidenceLevel,
    },
  });

  logger.log('workflow_recovery', 'start', 'Evaluating autonomous recovery strategy');
  const recovery = await runWorkflowRecovery({
    repository: workflowPayload.repository.full_name,
    workflowName: workflowPayload.workflow_run?.name,
    branch: workflowPayload.workflow_run?.head_branch,
    runId: workflowPayload.workflow_run?.id,
    failureAnalysis,
    logAnalysis: parsedLogs,
    suspiciousCommits,
    regressionRisk,
    executeAutoFix: false,
  });
  logger.log('workflow_recovery', 'success', 'Recovery strategy evaluated', {
    strategy: recovery.strategy,
    status: recovery.status,
    stabilizationProbability: recovery.stabilizationProbability,
  });

  logger.log('agent_coordination', 'start', 'Coordinating specialized engineering agents');
  const coordination = await runAgentCoordination({
    repository: workflowPayload.repository.full_name,
    triggerType: 'workflow_failure',
    workflowName: workflowPayload.workflow_run?.name,
    priority: regressionRisk.regressionRiskScore >= 80 ? 'CRITICAL' : regressionRisk.regressionRiskScore >= 60 ? 'HIGH' : 'MEDIUM',
  });
  logger.log('agent_coordination', 'success', 'Multi-agent coordination completed', {
    status: coordination.status,
    taskCount: coordination.tasks.length,
    findingCount: coordination.findings.length,
  });

  const engineeringSummaryResult = generateEngineeringSummary({
    workflowAnalysis: failureAnalysis,
    parsedLogAnalysis: parsedLogs,
    suspiciousCommits,
    regressionRisk,
  });

  logger.log('issue_creation', 'start', 'Simulating GitHub issue creation locally');
  const issue = createMockIssue(
    workflowPayload.repository.full_name,
    'Potential Regression Detected in Deploy and Test'
  );
  logger.log('issue_creation', 'success', 'Mock issue created', issue);
  await upsertIncident({
    incidentKey: incidentKey(['local-simulation', workflowPayload.repository.full_name, workflowPayload.workflow_run?.id]),
    severity: severityFromScore(regressionRisk.regressionRiskScore),
    repository: workflowPayload.repository.full_name,
    affectedBranch: workflowPayload.workflow_run?.head_branch,
    affectedFiles: parsedLogs.files,
    engineeringSummary: engineeringSummaryResult.summary,
    status: 'OPEN',
    relatedWorkflow: workflowPayload.workflow_run?.name,
    relatedIssue: issue.issueNumber,
    relatedUrl: issue.issueUrl,
    historySummary: 'Local simulation issue created for incident',
    historyDetails: issue,
  });

  logger.log('auto_fix_eligibility', 'start', 'Checking auto-fix safety rules');
  const autoFixEligibility = isSafeAutoFix({
    regressionRiskScore: regressionRisk.regressionRiskScore,
    confidenceLevel: regressionRisk.confidenceLevel,
    detectedFiles: parsedLogs.files,
    detectedErrors: parsedLogs.errors,
  });
  logger.log(
    'auto_fix_eligibility',
    autoFixEligibility.allowed ? 'success' : 'warning',
    autoFixEligibility.reason,
    { localSimulationWillStillExerciseFixGeneration: !autoFixEligibility.allowed }
  );

  logger.log('auto_fix_workflow', 'start', 'Simulating auto-fix workflow locally without pushing to GitHub');
  const autoFixResult = await simulateAutoFixWorkflow(
    parsedLogs.errors,
    parsedLogs.files,
    suspiciousCommits,
    engineeringSummaryResult.summary
  );
  logger.log('auto_fix_workflow', 'success', 'Auto-fix workflow simulation completed', {
    branchName: autoFixResult.branchName,
    pullRequestTitle: autoFixResult.pullRequestTitle,
    updatedFiles: autoFixResult.updatedFiles.map((file) => file.path),
  });
  await upsertIncident({
    incidentKey: incidentKey(['local-simulation', workflowPayload.repository.full_name, workflowPayload.workflow_run?.id]),
    severity: severityFromScore(regressionRisk.regressionRiskScore),
    repository: workflowPayload.repository.full_name,
    affectedBranch: workflowPayload.workflow_run?.head_branch,
    affectedFiles: parsedLogs.files,
    engineeringSummary: engineeringSummaryResult.summary,
    status: 'RESOLVED',
    relatedWorkflow: workflowPayload.workflow_run?.name,
    relatedIssue: issue.issueNumber,
    relatedUrl: issue.issueUrl,
    historySummary: 'Local auto-fix simulation completed and incident resolved',
    historyDetails: {
      branchName: autoFixResult.branchName,
      updatedFiles: autoFixResult.updatedFiles.map((file) => file.path),
    },
  });

  logger.log('simulation', 'success', 'Local end-to-end workflow execution test completed');

  return {
    regressionRiskScore: regressionRisk.regressionRiskScore,
    confidenceLevel: regressionRisk.confidenceLevel,
    suspiciousCommitCount: suspiciousCommits.length,
    issueUrl: issue.issueUrl,
    autoFixBranchName: autoFixResult.branchName,
    generatedFixCount: autoFixResult.updatedFiles.length,
  };
}

// Made with Bob
