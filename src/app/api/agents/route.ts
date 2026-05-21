import { auth } from '../../../../auth';
import { getPrisma } from '@/lib/database/prisma';
import { getLatestAgentCoordination, runAgentCoordination } from '@/lib/agents/coordinationEngine';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const repository = await getPrisma().connectedRepository.findUnique({
    where: { userId: session.user.id },
  });
  const repositoryName = repository ? `${repository.owner}/${repository.repoName}` : undefined;
  const runs = await getLatestAgentCoordination(repositoryName);

  return Response.json({ runs });
}

// made by bob
export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const repository = await getPrisma().connectedRepository.findUnique({
    where: { userId: session.user.id },
  });
  const repositoryName = repository ? `${repository.owner}/${repository.repoName}` : 'no repository connected';
  const run = await runAgentCoordination({
    repository: repositoryName,
    triggerType: 'manual',
  });

  return Response.json({ run });
}

// Made with Bob
// made by bob
