import { analyzeWorkflowFailure, WorkflowFailureAnalysis } from '../analyzeWorkflowFailure';
import { fetchWorkflowLogs } from '../fetchWorkflowLogs';
import { parseWorkflowLogs, ParsedWorkflowLogs } from '../parseWorkflowLogs';
import { correlateRecentCommits, SuspiciousCommit } from '../correlateRecentCommits';
import { calculateRegressionRisk, RegressionRiskResult } from '../calculateRegressionRisk';
import { createGithubIssue } from '../createGithubIssue';
import { generateEngineeringSummary } from '@/lib/ai/generateEngineeringSummary';
import { isSafeAutoFix } from '../isSafeAutoFix';
import { runAutoFixWorkflow } from '../runAutoFixWorkflow';
import { prisma } from '@/lib/database/prisma';
import { logActivityEvent } from '@/lib/activity/logActivityEvent';
import { incidentKey, severityFromScore, upsertIncident } from '@/lib/incidents/incidentManager';
import { runAutonomousInvestigation } from '@/lib/investigations/investigationEngine';
import { runWorkflowRecoveryFromWebhook } from '@/lib/recovery/workflowRecoveryEngine';
import { GitHubWebhookPayload } from '@/types';

export interface CombinedAnalysis {
  failureAnalysis: WorkflowFailureAnalysis;
  logAnalysis: ParsedWorkflowLogs;
  suspiciousCommits: SuspiciousCommit[];
  regressionRisk: RegressionRiskResult;
  engineeringSummary: string;
}

export interface HandlerResult {
  success: boolean;
  message?: string;
  analysis?: CombinedAnalysis;
}

export async function handleWorkflowRun(payload: GitHubWebhookPayload): Promise<HandlerResult> {
  const repository = payload.repository?.full_name || payload.repository?.name || 'unknown';
  const action = payload.action || 'unknown';
  const workflowName = payload.workflow_run?.name || 'unknown';
  const branch = payload.workflow_run?.head_branch || 'unknown';
  const status = payload.workflow_run?.status;
  const conclusion = payload.workflow_run?.conclusion;
  const runId = payload.workflow_run?.id;
  const installationId = payload.installation?.id;
  
  console.log('Workflow run event:', {
    repository,
    action,
    workflowName,
    branch,
    status,
    conclusion,
    runId,
  });

  // Only process completed workflow runs
  if (action !== 'completed') {
    return {
      success: true,
      message: `Skipped non-completed workflow run (${action}) in ${repository}`,
    };
  }

  // Only process failed conclusions
  if (conclusion?.toLowerCase() !== 'failure') {
    return {
      success: true,
      message: `Skipped successful workflow run in ${repository}`,
    };
  }

  // Analyze the workflow failure
  const failureAnalysis = analyzeWorkflowFailure(payload);

  if (!failureAnalysis) {
    return {
      success: true,
      message: `No analysis generated for workflow run in ${repository}`,
    };
  }

  // Log the failure analysis
  console.log('Workflow failure analysis:', {
    repository,
    workflowName,
    branch,
    severityScore: failureAnalysis.severityScore,
    summary: failureAnalysis.summary,
  });

  await logActivityEvent({
    eventType: 'workflow_failure',
    repository,
    severity: failureAnalysis.severityScore >= 70 ? 'danger' : 'warning',
    status: 'completed',
    summary: failureAnalysis.summary,
    details: {
      branch,
      runId,
      severityScore: failureAnalysis.severityScore,
      conclusion,
    },
    relatedWorkflow: workflowName,
  });

  await runAutonomousInvestigation({
    repository,
    branch,
    triggerType: 'workflow_failure',
    relatedWorkflow: workflowName,
  });

  await upsertIncident({
    incidentKey: incidentKey(['workflow', repository, workflowName, branch, runId]),
    severity: severityFromScore(failureAnalysis.severityScore),
    repository,
    affectedBranch: branch,
    engineeringSummary: failureAnalysis.summary,
    status: 'INVESTIGATING',
    relatedWorkflow: workflowName,
    historySummary: 'Workflow failure detected and incident opened',
    historyDetails: {
      runId,
      conclusion,
      severityScore: failureAnalysis.severityScore,
    },
  });

  // Fetch workflow logs URL
  let logsUrl: string | null = null;
  try {
    const [owner, repo] = repository.split('/');
    if (owner && repo && runId) {
      const logsResult = await fetchWorkflowLogs(owner, repo, runId, installationId);
      logsUrl = logsResult.logsUrl;
      console.log('Fetched workflow logs URL:', logsUrl);
    }
  } catch (error) {
    console.error('Failed to fetch workflow logs URL:', error);
    // Continue processing even if log fetch fails
  }

  // Simulate log content for now (placeholder)
  // TODO: Replace with actual log download when implemented
  const rawLogs = `
2024-01-15T10:30:45.123Z [error] Test suite failed
2024-01-15T10:30:45.234Z Error: Expected 200 but got 404
2024-01-15T10:30:45.345Z     at src/api/users.test.ts:45:12
2024-01-15T10:30:45.456Z     at src/lib/http-client.ts:89:5
2024-01-15T10:30:46.567Z [fail] 3 tests failed, 12 passed
2024-01-15T10:30:46.678Z TypeError: Cannot read property 'id' of undefined
2024-01-15T10:30:46.789Z     at src/services/user-service.ts:123:20
2024-01-15T10:30:47.890Z Compilation error in src/components/Header.tsx
2024-01-15T10:30:47.901Z Module not found: Cannot resolve './utils/helpers'
  `;

  // Parse workflow logs
  const logAnalysis = parseWorkflowLogs(rawLogs);

  // Log the parsed analysis
  console.log('Parsed log analysis:', {
    errorsCount: logAnalysis.errors.length,
    filesCount: logAnalysis.files.length,
    summary: logAnalysis.summary,
  });

  console.log('Detected errors:', logAnalysis.errors);
  console.log('Detected files:', logAnalysis.files);

  // Correlate recent commits with detected files
  let suspiciousCommits: SuspiciousCommit[] = [];
  
  if (logAnalysis.files.length > 0) {
    try {
      const [owner, repo] = repository.split('/');
      if (owner && repo) {
        const commitCorrelation = await correlateRecentCommits(
          owner,
          repo,
          branch,
          logAnalysis.files,
          installationId
        );
        suspiciousCommits = commitCorrelation.suspiciousCommits;

        // Log commit correlation results
        console.log('Commit correlation:', {
          suspiciousCommitCount: suspiciousCommits.length,
          commitSHAs: suspiciousCommits.map(c => c.sha),
        });

        await logActivityEvent({
          eventType: 'suspicious_commit',
          repository,
          severity: suspiciousCommits.length > 0 ? 'warning' : 'info',
          status: 'completed',
          summary: `${suspiciousCommits.length} suspicious commit(s) correlated with workflow failure`,
          details: {
            branch,
            commits: suspiciousCommits.map((commit) => ({
              sha: commit.sha,
              author: commit.author,
              matchedFiles: commit.matchedFiles,
            })),
          },
          relatedWorkflow: workflowName,
        });

        // Log details of each suspicious commit
        for (const commit of suspiciousCommits) {
          console.log('Suspicious commit:', {
            sha: commit.sha,
            author: commit.author,
            message: commit.message.split('\n')[0], // First line only
            matchedFiles: commit.matchedFiles,
          });
        }
      }
    } catch (error) {
      console.error('Failed to correlate commits:', error);
      // Continue processing even if commit correlation fails
    }
  } else {
    console.log('Skipping commit correlation: no files detected in logs');
  }

  // Calculate regression risk
  const regressionRisk = calculateRegressionRisk({
    severityScore: failureAnalysis.severityScore,
    detectedErrors: logAnalysis.errors,
    detectedFiles: logAnalysis.files,
    suspiciousCommits: suspiciousCommits,
    branch: branch,
  });

  // Log regression risk
  console.log('Regression risk assessment:', {
    regressionRiskScore: regressionRisk.regressionRiskScore,
    confidenceLevel: regressionRisk.confidenceLevel,
  });

  await logActivityEvent({
    eventType: 'regression_alert',
    repository,
    severity: regressionRisk.confidenceLevel === 'HIGH' ? 'danger' : regressionRisk.confidenceLevel === 'MEDIUM' ? 'warning' : 'info',
    status: 'completed',
    summary: `Regression risk ${regressionRisk.regressionRiskScore}/100 (${regressionRisk.confidenceLevel})`,
    details: {
      branch,
      detectedFiles: logAnalysis.files,
      detectedErrors: logAnalysis.errors.slice(0, 5),
    },
    relatedWorkflow: workflowName,
  });

  await upsertIncident({
    incidentKey: incidentKey(['regression', repository, workflowName, branch, runId]),
    severity: severityFromScore(regressionRisk.regressionRiskScore),
    repository,
    affectedBranch: branch,
    affectedFiles: logAnalysis.files,
    engineeringSummary: `Regression risk ${regressionRisk.regressionRiskScore}/100 (${regressionRisk.confidenceLevel})`,
    status: 'ANALYZING',
    relatedWorkflow: workflowName,
    historySummary: 'Regression risk calculated',
    historyDetails: {
      regressionRisk,
      detectedFiles: logAnalysis.files,
      suspiciousCommits: suspiciousCommits.map((commit) => commit.sha),
    },
  });

  await runWorkflowRecoveryFromWebhook({
    payload,
    failureAnalysis,
    logAnalysis,
    suspiciousCommits,
    regressionRisk,
    executeAutoFix: false,
  });

  // Generate engineering summary
  const engineeringSummaryResult = generateEngineeringSummary({
    workflowAnalysis: failureAnalysis,
    parsedLogAnalysis: logAnalysis,
    suspiciousCommits: suspiciousCommits,
    regressionRisk: regressionRisk,
  });

  // Log engineering summary
  console.log('Engineering summary generated:');
  console.log(engineeringSummaryResult.summary);

  await logActivityEvent({
    eventType: 'ai_analysis',
    repository,
    severity: 'success',
    status: 'completed',
    summary: 'Engineering summary generated for workflow failure',
    details: engineeringSummaryResult.summary.slice(0, 1200),
    relatedWorkflow: workflowName,
  });

  // Create GitHub issue for high regression risk
  if (regressionRisk.regressionRiskScore >= 70) {
    try {
      const [owner, repo] = repository.split('/');
      if (owner && repo) {
        // Format issue title
        const issueTitle = `Potential Regression Detected in ${workflowName}`;

        // Format issue body
        const issueBody = `## Workflow Failure Analysis

**Workflow Name:** ${workflowName}
**Branch:** ${branch}
**Severity Score:** ${failureAnalysis.severityScore}
**Regression Risk Score:** ${regressionRisk.regressionRiskScore}
**Confidence Level:** ${regressionRisk.confidenceLevel}

### Detected Files
${logAnalysis.files.length > 0 ? logAnalysis.files.map(f => `- \`${f}\``).join('\n') : 'No files detected'}

### Suspicious Commits
${suspiciousCommits.length > 0 ? suspiciousCommits.map(c =>
  `- **${c.sha.substring(0, 7)}** by ${c.author}: ${c.message.split('\n')[0]}\n  Files: ${c.matchedFiles.map(f => `\`${f}\``).join(', ')}`
).join('\n') : 'No suspicious commits found'}

---
*This issue was automatically created by the workflow failure analysis system.*`;

        // Create the issue
        const issueResult = await createGithubIssue(owner, repo, issueTitle, issueBody, installationId);

        console.log('Created GitHub issue for high regression risk:', {
          issueNumber: issueResult.issueNumber,
          issueUrl: issueResult.issueUrl,
        });

        await logActivityEvent({
          eventType: 'issue_creation',
          repository,
          severity: 'warning',
          status: 'completed',
          summary: `Created regression issue #${issueResult.issueNumber}`,
          details: {
            workflowName,
            regressionRiskScore: regressionRisk.regressionRiskScore,
          },
          relatedWorkflow: workflowName,
          relatedIssue: issueResult.issueNumber,
          relatedUrl: issueResult.issueUrl,
        });

        await upsertIncident({
          incidentKey: incidentKey(['regression', repository, workflowName, branch, runId]),
          severity: severityFromScore(regressionRisk.regressionRiskScore),
          repository,
          affectedBranch: branch,
          affectedFiles: logAnalysis.files,
          engineeringSummary: engineeringSummaryResult.summary,
          status: 'OPEN',
          relatedWorkflow: workflowName,
          relatedIssue: issueResult.issueNumber,
          relatedUrl: issueResult.issueUrl,
          historySummary: `GitHub issue #${issueResult.issueNumber} created for regression incident`,
          historyDetails: {
            issueUrl: issueResult.issueUrl,
          },
        });
      }
    } catch (error) {
      console.error('Failed to create GitHub issue:', error);
      // Continue processing even if issue creation fails
    }
  } else {
    console.log('Skipping GitHub issue creation: regression risk score below threshold (70)');
  }

  // Check auto-fix eligibility and run workflow if allowed
  if (
    regressionRisk.regressionRiskScore >= 70 &&
    regressionRisk.confidenceLevel === 'HIGH'
  ) {
    // Check if auto-fix is safe
    const autoFixEligibility = isSafeAutoFix({
      regressionRiskScore: regressionRisk.regressionRiskScore,
      confidenceLevel: regressionRisk.confidenceLevel,
      detectedFiles: logAnalysis.files,
      detectedErrors: logAnalysis.errors,
    });

    if (autoFixEligibility.allowed) {
      console.log('Auto-fix eligibility check passed. Starting automated fix workflow...');
      
      try {
        const [owner, repo] = repository.split('/');
        const defaultBranch = payload.repository?.default_branch || 'main';
        const cloneUrl = payload.repository?.clone_url || '';

        if (owner && repo && cloneUrl) {
          console.log('Auto-fix workflow started:', {
            repository,
            branch,
            regressionRiskScore: regressionRisk.regressionRiskScore,
          });

          await upsertIncident({
            incidentKey: incidentKey(['regression', repository, workflowName, branch, runId]),
            severity: severityFromScore(regressionRisk.regressionRiskScore),
            repository,
            affectedBranch: branch,
            affectedFiles: logAnalysis.files,
            engineeringSummary: engineeringSummaryResult.summary,
            status: 'AUTOFIX_RUNNING',
            relatedWorkflow: workflowName,
            historySummary: 'Auto-fix workflow started for incident',
          });

          const autoFixResult = await runAutoFixWorkflow({
            repositoryCloneUrl: cloneUrl,
            repositoryOwner: owner,
            repositoryName: repo,
            baseBranch: defaultBranch,
            detectedFiles: logAnalysis.files,
            detectedErrors: logAnalysis.errors,
            suspiciousCommits: suspiciousCommits,
            regressionRisk: regressionRisk,
            engineeringSummary: engineeringSummaryResult.summary,
            installationId,
          });

          if (autoFixResult.success) {
            console.log('Auto-fix workflow completed successfully:', {
              branchName: autoFixResult.branchName,
              pullRequestUrl: autoFixResult.pullRequestUrl,
            });
            await logActivityEvent({
              eventType: 'pr_generation',
              repository,
              severity: 'success',
              status: 'completed',
              summary: `Auto-fix pull request created from ${autoFixResult.branchName}`,
              details: {
                branchName: autoFixResult.branchName,
                pullRequestUrl: autoFixResult.pullRequestUrl,
              },
              relatedWorkflow: workflowName,
              relatedUrl: autoFixResult.pullRequestUrl,
            });
            await upsertIncident({
              incidentKey: incidentKey(['regression', repository, workflowName, branch, runId]),
              severity: severityFromScore(regressionRisk.regressionRiskScore),
              repository,
              affectedBranch: branch,
              affectedFiles: logAnalysis.files,
              engineeringSummary: engineeringSummaryResult.summary,
              status: 'RESOLVED',
              relatedWorkflow: workflowName,
              relatedUrl: autoFixResult.pullRequestUrl,
              historySummary: 'Auto-fix pull request created and incident marked resolved',
              historyDetails: {
                branchName: autoFixResult.branchName,
                pullRequestUrl: autoFixResult.pullRequestUrl,
              },
            });
          } else {
            console.error('Auto-fix workflow failed:', autoFixResult.error);
            await logActivityEvent({
              eventType: 'autofix_execution',
              repository,
              severity: 'danger',
              status: 'failed',
              summary: `Auto-fix workflow failed: ${autoFixResult.error}`,
              relatedWorkflow: workflowName,
            });
          }
        }
      } catch (error) {
        console.error('Failed to run auto-fix workflow:', error);
        // Continue processing even if auto-fix fails
      }
    } else {
      console.log('Skipping auto-fix workflow:', autoFixEligibility.reason);
    }
  } else {
    console.log('Skipping auto-fix workflow: eligibility criteria not met (score < 70 or confidence not HIGH)');
  }

  // Combine analyses
  const combinedAnalysis: CombinedAnalysis = {
    failureAnalysis,
    logAnalysis,
    suspiciousCommits,
    regressionRisk,
    engineeringSummary: engineeringSummaryResult.summary,
  };

  // Save to database
  try {
    await prisma.githubEvent.create({
      data: {
        eventType: 'workflow_failure',
      },
    });

    console.log('Saved workflow_failure event to database');
  } catch (error) {
    console.error('Failed to save workflow_failure event to database:', error);
    return {
      success: false,
      message: `Failed to save workflow failure event: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
  
  return {
    success: true,
    message: `Processed workflow failure in ${repository} (severity: ${failureAnalysis.severityScore})`,
    analysis: combinedAnalysis,
  };
}

// Made with Bob
