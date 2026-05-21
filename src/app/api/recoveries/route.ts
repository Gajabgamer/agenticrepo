import { auth } from '../../../../auth';
import { getPrisma } from '@/lib/database/prisma';
import { runWorkflowRecovery } from '@/lib/recovery/workflowRecoveryEngine';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const recoveries = await getPrisma().workflowRecovery.findMany({
    include: {
      steps: {
        orderBy: { startedAt: 'asc' },
      },
    },
    orderBy: { startedAt: 'desc' },
    take: 20,
  });

  return Response.json({ recoveries });
}

// made by bob
export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prisma = getPrisma();
  const [repository, user] = await Promise.all([
    prisma.connectedRepository.findUnique({ where: { userId: session.user.id } }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        autoFixEnabled: true,
        bobApiKey: true,
        groqApiKey: true,
        preferredAiProvider: true,
      },
    }),
  ]);
  const repositoryName = repository ? `${repository.owner}/${repository.repoName}` : 'no repository connected';
  const providerConnected = user?.preferredAiProvider === 'groq'
    ? Boolean(user.groqApiKey || process.env.GROQ_API_KEY)
    : Boolean(user?.bobApiKey || process.env.BOB_API_KEY);

  const recovery = await runWorkflowRecovery({
    repository: repositoryName,
    workflowName: 'Deploy and Test',
    branch: repository?.defaultBranch,
    cloneUrl: repository?.cloneUrl,
    defaultBranch: repository?.defaultBranch,
    executeAutoFix: Boolean(repository && user?.autoFixEnabled && providerConnected),
  });

  return Response.json({ recovery });
}

// Made with Bob
// made by bob
