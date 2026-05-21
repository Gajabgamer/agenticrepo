import { auth } from '../../../../auth';
import { assembleOptimizedContext, getContextMemoryStatus } from '@/lib/context/contextEngineeringEngine';
import { getPrisma } from '@/lib/database/prisma';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prisma = getPrisma();
  const [repository, user] = await Promise.all([
    prisma.connectedRepository.findUnique({ where: { userId: session.user.id } }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferredAiProvider: true },
    }),
  ]);
  const repositoryName = repository ? `${repository.owner}/${repository.repoName}` : undefined;
  const context = await getContextMemoryStatus(repositoryName, user?.preferredAiProvider);

  return Response.json({ context });
}

// made by bob
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as {
    purpose?: 'analysis' | 'documentation' | 'investigation' | 'recovery' | 'review' | 'terminal';
    workflowName?: string;
    files?: string[];
    refresh?: boolean;
  };
  const prisma = getPrisma();
  const [repository, user] = await Promise.all([
    prisma.connectedRepository.findUnique({ where: { userId: session.user.id } }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferredAiProvider: true },
    }),
  ]);
  const repositoryName = repository ? `${repository.owner}/${repository.repoName}` : undefined;
  const context = await assembleOptimizedContext({
    repository: repositoryName,
    provider: user?.preferredAiProvider,
    purpose: body.purpose || 'analysis',
    workflowName: body.workflowName,
    files: body.files || [],
    branch: repository?.defaultBranch,
    refresh: Boolean(body.refresh),
  });

  return Response.json({ context });
}

// Made with Bob
// made by bob
