import { createGithubOctokit } from './auth';

export interface CreateIssueResult {
  issueNumber: number;
  issueUrl: string;
}

/**
 * Creates a GitHub issue in the specified repository.
 * 
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param title - Issue title
 * @param body - Issue body/description
 * @returns Object containing issue number and URL
 * @throws Error if API call fails
 */
export async function createGithubIssue(
  owner: string,
  repo: string,
  title: string,
  body: string,
  installationId?: number
): Promise<CreateIssueResult> {
  const octokit = await createGithubOctokit(installationId);

  try {
    // Create GitHub issue
    const response = await octokit.issues.create({
      owner,
      repo,
      title,
      body,
    });

    return {
      issueNumber: response.data.number,
      issueUrl: response.data.html_url,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create GitHub issue: ${error.message}`);
    }
    throw new Error('Failed to create GitHub issue: Unknown error');
  }
}

// Made with Bob
