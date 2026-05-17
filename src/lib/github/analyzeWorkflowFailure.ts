export interface WorkflowFailureAnalysis {
  severityScore: number;
  summary: string;
}

export interface WorkflowRunPayload {
  workflow_run?: {
    name?: string;
    head_branch?: string;
    head_sha?: string;
    conclusion?: string;
    status?: string;
  };
  repository?: {
    name?: string;
    full_name?: string;
  };
  sender?: {
    login?: string;
  };
}

/**
 * Analyzes a failed workflow run and generates a severity score and summary.
 * Only processes workflow runs with a failed conclusion.
 * 
 * @param payload - The workflow_run webhook payload
 * @returns Analysis with severity score and summary, or null if not a failure
 */
export function analyzeWorkflowFailure(
  payload: WorkflowRunPayload
): WorkflowFailureAnalysis | null {
  const workflowRun = payload.workflow_run;
  const conclusion = workflowRun?.conclusion?.toLowerCase();

  // Only analyze failed workflow runs
  if (conclusion !== 'failure') {
    return null;
  }

  // Extract required information
  const workflowName = workflowRun?.name || 'Unknown Workflow';
  const repositoryName = payload.repository?.full_name || payload.repository?.name || 'unknown';
  const branch = workflowRun?.head_branch || 'unknown';
  const commitSha = workflowRun?.head_sha || 'unknown';
  const triggeringActor = payload.sender?.login || 'unknown';

  // Calculate severity score
  let severityScore = 0;

  // +10 if conclusion is failure (always true in this function)
  severityScore += 10;

  // +40 if branch is main or master
  const branchLower = branch.toLowerCase();
  if (branchLower === 'main' || branchLower === 'master') {
    severityScore += 40;
  }

  // +30 if workflow name contains "deploy"
  const workflowNameLower = workflowName.toLowerCase();
  if (workflowNameLower.includes('deploy')) {
    severityScore += 30;
  }

  // +20 if workflow name contains "test"
  if (workflowNameLower.includes('test')) {
    severityScore += 20;
  }

  // Generate summary
  const summary = `Workflow "${workflowName}" failed on ${repositoryName}@${branch} (${commitSha.substring(0, 7)}) triggered by ${triggeringActor}`;

  return {
    severityScore,
    summary,
  };
}

// Made with Bob
