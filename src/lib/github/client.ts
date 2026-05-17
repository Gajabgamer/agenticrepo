import config from '@/config';
import { GitHubRepository } from '@/types';
import { retry } from '@/lib/utils';

/**
 * GitHub API Client
 * Handles all interactions with GitHub API
 */
export class GitHubClient {
  private baseUrl: string;
  private token: string;

  constructor() {
    this.baseUrl = config.github.apiUrl;
    this.token = config.github.token;
  }

  /**
   * Get repository information
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    return retry(async () => {
      const response = await fetch(
        `${this.baseUrl}/repos/${owner}/${repo}`,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      return response.json();
    });
  }

  /**
   * List repositories for authenticated user
   */
  async listRepositories(): Promise<GitHubRepository[]> {
    return retry(async () => {
      const response = await fetch(`${this.baseUrl}/user/repos`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      return response.json();
    });
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    // Implementation would use crypto to verify HMAC signature
    // This is a placeholder for the actual implementation
    return true;
  }
}

export const githubClient = new GitHubClient();

// Made with Bob
