import { createGithubOctokit } from './auth';

export interface CreatePullRequestResult {
  pullRequestNumber: number;
  pullRequestUrl: string;
}

/**
 * Creates a GitHub pull request in the specified repository.
 * 
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param title - Pull request title
 * @param body - Pull request body/description
 * @param head - The name of the branch where your changes are implemented
 * @param base - The name of the branch you want the changes pulled into
 * @returns Object containing pull request number and URL
 * @throws Error if API call fails
 */
export async function createPullRequest(
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base: string,
  installationId?: number
): Promise<CreatePullRequestResult> {
  const octokit = await createGithubOctokit(installationId);

  try {
    // Create GitHub pull request
    const response = await octokit.pulls.create({
      owner,
      repo,
      title,
      body,
      head,
      base,
    });

    return {
      pullRequestNumber: response.data.number,
      pullRequestUrl: response.data.html_url,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create pull request: ${error.message}`);
    }
    throw new Error('Failed to create pull request: Unknown error');
  }
}

// Made with Bob
