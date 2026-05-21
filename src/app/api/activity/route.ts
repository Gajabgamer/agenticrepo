import { auth } from '../../../../auth';
import { getPrisma } from '@/lib/database/prisma';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const events = await getPrisma().activityEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 40,
  });

  return Response.json({
    events: events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      repository: event.repository,
      severity: event.severity,
      status: event.status,
      summary: event.summary,
      details: event.details,
      relatedWorkflow: event.relatedWorkflow,
      relatedPr: event.relatedPr,
      relatedIssue: event.relatedIssue,
      relatedUrl: event.relatedUrl,
      createdAt: event.createdAt.toISOString(),
    })),
  });
}

// Made with Bob
// made by bob
