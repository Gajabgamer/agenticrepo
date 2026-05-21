import { auth } from '../../../../auth';
import { getPrisma } from '@/lib/database/prisma';
import { getEngineeringMemorySnapshot, refreshEngineeringMemory } from '@/lib/memory/engineeringMemoryEngine';

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
  const memory = await getEngineeringMemorySnapshot(repositoryName);

  return Response.json({ memory });
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
  const repositoryName = repository ? `${repository.owner}/${repository.repoName}` : undefined;
  const memory = await refreshEngineeringMemory(repositoryName);

  return Response.json({ memory });
}

// Made with Bob
// made by bob
