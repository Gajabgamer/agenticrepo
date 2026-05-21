import { auth } from '../../../../auth';
import { getPrisma } from '@/lib/database/prisma';
import { runAutonomousInvestigation } from '@/lib/investigations/investigationEngine';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const investigations = await getPrisma().investigation.findMany({
    include: {
      steps: {
        orderBy: { startedAt: 'asc' },
      },
    },
    orderBy: { startedAt: 'desc' },
    take: 20,
  });

  return Response.json({ investigations });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json() as {
    triggerType?: 'workflow_failure' | 'terminal' | 'incident' | 'repository';
    repository?: string;
    relatedWorkflow?: string;
    relatedPr?: number;
  };
  const repository = await getPrisma().connectedRepository.findUnique({
    where: { userId: session.user.id },
  });
  const repositoryName = body.repository || (repository ? `${repository.owner}/${repository.repoName}` : 'no repository connected');
  const investigation = await runAutonomousInvestigation({
    repository: repositoryName,
    triggerType: body.triggerType || 'terminal',
    relatedWorkflow: body.relatedWorkflow,
    relatedPr: body.relatedPr,
    branch: repository?.defaultBranch,
  });

  return Response.json({ investigation });
}

// Made with Bob
// made by bob
