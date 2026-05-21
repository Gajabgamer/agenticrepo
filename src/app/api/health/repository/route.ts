import { auth } from '../../../../../auth';
import { getPrisma } from '@/lib/database/prisma';
import { calculateRepositoryHealth } from '@/lib/health/repositoryHealthEngine';

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
  const health = await calculateRepositoryHealth(repositoryName);

  return Response.json({ health });
}

// Made with Bob
// made by bob
