import { getPrisma } from '@/lib/database/prisma';

export const runtime = 'nodejs';

// made by bob
export async function GET() {
  const prisma = getPrisma();
  const [events, recoveries, incidents] = await Promise.all([
    prisma.activityEvent.findMany({
      where: {
        eventType: {
          in: ['workflow_failure', 'workflow_recovery', 'successful_fix'],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.workflowRecovery.findMany({
      orderBy: { startedAt: 'desc' },
      take: 20,
    }),
    prisma.incident.findMany({
      where: {
        relatedWorkflow: {
          not: null,
        },
      },
      orderBy: { openedAt: 'desc' },
      take: 20,
    }),
  ]);

  return Response.json({
    workflows: {
      events: events.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        repository: event.repository,
        status: event.status,
        severity: event.severity,
        summary: event.summary,
        relatedWorkflow: event.relatedWorkflow,
        createdAt: event.createdAt.toISOString(),
      })),
      recoveries: recoveries.map((recovery) => ({
        id: recovery.id,
        repository: recovery.repository,
        workflowName: recovery.workflowName,
        status: recovery.status,
        strategy: recovery.strategy,
        confidenceScore: recovery.confidenceScore,
        stabilizationProbability: recovery.stabilizationProbability,
        startedAt: recovery.startedAt.toISOString(),
      })),
      incidents: incidents.map((incident) => ({
        id: incident.id,
        repository: incident.repository,
        relatedWorkflow: incident.relatedWorkflow,
        severity: incident.severity,
        status: incident.status,
        summary: incident.engineeringSummary,
        openedAt: incident.openedAt.toISOString(),
      })),
    },
  });
}

// Made with Bob
// made by bob
