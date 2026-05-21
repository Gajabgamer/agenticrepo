import type { ActivityEvent, Incident, PullRequestAnalysis } from '@prisma/client';
import { prisma } from '@/lib/database/prisma';

export type HealthStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL';

export type RepositoryHealthResult = {
  repository: string;
  healthScore: number;
  status: HealthStatus;
  workflowFailures: number;
  regressionIncidents: number;
  failedPullRequests: number;
  suspiciousCommits: number;
  unresolvedIssues: number;
  autoFixSuccesses: number;
  autoFixFailures: number;
  workflowReliability: number;
  autoFixSuccessRate: number;
  stabilityTrend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
  activeIncidents: Incident[];
  recentIncidents: Array<Incident & { history: Array<{ id: string; status: string; summary: string; details: string | null; createdAt: Date }> }>;
  recentActivity: ActivityEvent[];
};

const lookbackLimit = 80;

// made by bob
export async function calculateRepositoryHealth(repository?: string): Promise<RepositoryHealthResult> {
  const where = repository ? { repository } : {};
  const [activity, analyses, activeIncidents, recentIncidents, previousSnapshot] = await Promise.all([
    prisma.activityEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: lookbackLimit,
    }),
    prisma.pullRequestAnalysis.findMany({
      where: repository ? { repository: repository.split('/').pop() || repository } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.incident.findMany({
      where: {
        ...where,
        status: { not: 'RESOLVED' },
      },
      orderBy: { openedAt: 'desc' },
      take: 20,
    }),
    prisma.incident.findMany({
      where,
      include: {
        history: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
      orderBy: { openedAt: 'desc' },
      take: 20,
    }),
    prisma.repositoryHealthSnapshot.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const workflowFailures = countEvents(activity, 'workflow_failure');
  const regressionIncidents = countEvents(activity, 'regression_alert') + activeIncidents.filter((incident) => incident.severity === 'HIGH' || incident.severity === 'CRITICAL').length;
  const failedPullRequests = analyses.filter((analysis) => analysis.riskScore >= 70).length;
  const suspiciousCommits = countEvents(activity, 'suspicious_commit');
  const unresolvedIssues = countEvents(activity, 'issue_creation') + activeIncidents.length;
  const autoFixSuccesses = countEvents(activity, 'successful_fix') + countEvents(activity, 'pr_generation');
  const autoFixFailures = activity.filter((event) => event.eventType === 'autofix_execution' && event.status === 'failed').length;

  const penalty =
    workflowFailures * 8 +
    regressionIncidents * 10 +
    failedPullRequests * 7 +
    suspiciousCommits * 4 +
    unresolvedIssues * 4 +
    autoFixFailures * 8 -
    autoFixSuccesses * 5;
  const healthScore = clamp(100 - penalty, 0, 100);
  const workflowReliability = clamp(100 - workflowFailures * 12, 0, 100);
  const autoFixAttempts = autoFixSuccesses + autoFixFailures;
  const autoFixSuccessRate = autoFixAttempts === 0 ? 100 : Math.round((autoFixSuccesses / autoFixAttempts) * 100);
  const status = healthScore >= 80 ? 'HEALTHY' : healthScore >= 50 ? 'WARNING' : 'CRITICAL';
  const stabilityTrend = previousSnapshot
    ? healthScore > previousSnapshot.healthScore + 4
      ? 'IMPROVING'
      : healthScore < previousSnapshot.healthScore - 4
        ? 'DEGRADING'
        : 'STABLE'
    : 'STABLE';
  const targetRepository = repository || inferRepository(activity, analyses, activeIncidents);

  await prisma.repositoryHealthSnapshot.create({
    data: {
      repository: targetRepository,
      healthScore,
      status,
      workflowFailures,
      regressionIncidents,
      failedPullRequests,
      suspiciousCommits,
      unresolvedIssues,
      autoFixSuccesses,
      autoFixFailures,
      workflowReliability,
      autoFixSuccessRate,
      stabilityTrend,
    },
  });

  return {
    repository: targetRepository,
    healthScore,
    status,
    workflowFailures,
    regressionIncidents,
    failedPullRequests,
    suspiciousCommits,
    unresolvedIssues,
    autoFixSuccesses,
    autoFixFailures,
    workflowReliability,
    autoFixSuccessRate,
    stabilityTrend,
    activeIncidents,
    recentIncidents,
    recentActivity: activity.slice(0, 20),
  };
}

function countEvents(events: ActivityEvent[], eventType: string): number {
  return events.filter((event) => event.eventType === eventType).length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function inferRepository(activity: ActivityEvent[], analyses: PullRequestAnalysis[], incidents: Incident[]): string {
  return activity[0]?.repository || incidents[0]?.repository || analyses[0]?.repository || 'no repository connected';
}

// Made with Bob
// made by bob
