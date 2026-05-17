import { auth } from '../../../../../auth';
import { getPrisma } from '@/lib/database/prisma';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json() as {
    repoName?: string;
    owner?: string;
    cloneUrl?: string;
    defaultBranch?: string;
  };

  if (!body.repoName || !body.owner || !body.cloneUrl || !body.defaultBranch) {
    return Response.json({ error: 'Repository details are required' }, { status: 400 });
  }

  const repository = await getPrisma().connectedRepository.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      repoName: body.repoName,
      owner: body.owner,
      cloneUrl: body.cloneUrl,
      defaultBranch: body.defaultBranch,
    },
    update: {
      repoName: body.repoName,
      owner: body.owner,
      cloneUrl: body.cloneUrl,
      defaultBranch: body.defaultBranch,
    },
  });

  return Response.json({
    repository: {
      repoName: repository.repoName,
      owner: repository.owner,
      cloneUrl: repository.cloneUrl,
      defaultBranch: repository.defaultBranch,
    },
  });
}

// Made with Bob
// made by bob
