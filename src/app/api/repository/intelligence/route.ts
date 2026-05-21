import { auth } from '../../../../../auth';
import { logActivityEvent } from '@/lib/activity/logActivityEvent';
import { analyzeConnectedRepository } from '@/lib/repository/repositoryIntelligence';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const intelligence = await analyzeConnectedRepository(session.user.id);
    await logActivityEvent({
      eventType: 'repository_investigation',
      repository: intelligence.repository,
      severity: intelligence.hotspots.length > 0 ? 'warning' : 'success',
      status: 'completed',
      summary: `Repository architecture intelligence generated for ${intelligence.repository}`,
      details: {
        modules: intelligence.modules.length,
        workflows: intelligence.workflows.length,
        hotspots: intelligence.hotspots.length,
      },
    });

    return Response.json({ intelligence });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze repository' },
      { status: 400 }
    );
  }
}

// Made with Bob
// made by bob
