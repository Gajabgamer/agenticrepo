import { auth } from '../../../../auth';
import { getPrisma } from '@/lib/database/prisma';
import { decryptSecret } from '@/lib/security/secrets';

export const runtime = 'nodejs';

interface GitHubRepositoryResponse {
  name: string;
  owner: {
    login: string;
  };
  clone_url: string;
  default_branch: string;
  full_name: string;
  private: boolean;
}

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await getPrisma().user.findUnique({
    where: { id: session.user.id },
    select: { githubAccessToken: true },
  });

  if (!user?.githubAccessToken) {
    return Response.json({ error: 'GitHub token not available' }, { status: 400 });
  }

  const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
    headers: {
      Authorization: `Bearer ${decryptSecret(user.githubAccessToken)}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    return Response.json({ error: 'Failed to fetch repositories' }, { status: response.status });
  }

  const repositories = (await response.json()) as GitHubRepositoryResponse[];

  return Response.json({
    repositories: repositories.map((repo) => ({
      name: repo.name,
      owner: repo.owner.login,
      fullName: repo.full_name,
      cloneUrl: repo.clone_url,
      defaultBranch: repo.default_branch,
      private: repo.private,
    })),
  });
}

// Made with Bob
// made by bob
