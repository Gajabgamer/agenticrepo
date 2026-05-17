import { createGithubOctokit } from './auth';

export interface WorkflowLogsResult {
  logsUrl: string;
}

/**
 * Fetches the download URL for workflow run logs from GitHub.
 * 
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param runId - Workflow run ID
 * @returns Object containing the logs download URL
 * @throws Error if API call fails
 */
export async function fetchWorkflowLogs(
  owner: string,
  repo: string,
  runId: number,
  installationId?: number
): Promise<WorkflowLogsResult> {
  const octokit = await createGithubOctokit(installationId);

  try {
    // Fetch workflow run logs download URL
    const response = await octokit.actions.downloadWorkflowRunLogs({
      owner,
      repo,
      run_id: runId,
    });

    // The response.url contains the download URL for the logs
    const logsUrl = response.url;

    return {
      logsUrl,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch workflow logs: ${error.message}`);
    }
    throw new Error('Failed to fetch workflow logs: Unknown error');
  }
}

// Made with Bob
