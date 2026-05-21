import { auth } from '../../../../auth';
import { getPrisma } from '@/lib/database/prisma';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const incidents = await getPrisma().incident.findMany({
    include: {
      history: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
    orderBy: { openedAt: 'desc' },
    take: 50,
  });

  return Response.json({
    incidents: incidents.map((incident) => ({
      id: incident.id,
      incidentKey: incident.incidentKey,
      severity: incident.severity,
      repository: incident.repository,
      affectedBranch: incident.affectedBranch,
      affectedFiles: incident.affectedFiles,
      engineeringSummary: incident.engineeringSummary,
      status: incident.status,
      relatedWorkflow: incident.relatedWorkflow,
      relatedPr: incident.relatedPr,
      relatedIssue: incident.relatedIssue,
      relatedUrl: incident.relatedUrl,
      openedAt: incident.openedAt.toISOString(),
      updatedAt: incident.updatedAt.toISOString(),
      resolvedAt: incident.resolvedAt?.toISOString() || null,
      history: incident.history.map((entry) => ({
        id: entry.id,
        status: entry.status,
        summary: entry.summary,
        details: entry.details,
        createdAt: entry.createdAt.toISOString(),
      })),
    })),
  });
}

// Made with Bob
// made by bob
