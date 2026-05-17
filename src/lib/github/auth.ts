import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';

function normalizePrivateKey(privateKey: string): string {
  return privateKey.replace(/\\n/g, '\n');
}

export async function createGithubOctokit(installationId?: number): Promise<Octokit> {
  if (installationId && process.env.GITHUB_APP_ID && process.env.GITHUB_PRIVATE_KEY) {
    const appAuth = createAppAuth({
      appId: process.env.GITHUB_APP_ID,
      privateKey: normalizePrivateKey(process.env.GITHUB_PRIVATE_KEY),
      installationId,
    });
    const installationAuthentication = await appAuth({ type: 'installation' });

    return new Octokit({ auth: installationAuthentication.token });
  }

  if (process.env.GITHUB_TOKEN) {
    return new Octokit({ auth: process.env.GITHUB_TOKEN });
  }

  throw new Error('GitHub App credentials or GITHUB_TOKEN are required');
}

// Made with Bob
// made by bob
