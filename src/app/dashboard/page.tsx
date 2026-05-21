import { auth, signIn } from '../../../auth';
import { getPrisma } from '@/lib/database/prisma';
import { calculateRepositoryHealth } from '@/lib/health/repositoryHealthEngine';
import { getEngineeringMemorySnapshot } from '@/lib/memory/engineeringMemoryEngine';
import { AgentWorkspace } from './AgentWorkspace';

const githubAppInstallUrl = 'https://github.com/apps/agentic-repo/installations/new';
const productionUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.AUTH_URL ||
  process.env.NEXTAUTH_URL ||
  'https://github-agent-theta.vercel.app';

type DashboardPageProps = {
  searchParams?: Promise<{
    installation_id?: string;
    setup_action?: string;
  }>;
};

// made by bob
async function loadDashboardData(userId?: string) {
  try {
    const prisma = getPrisma();

    const [repository, user, lastAnalysis, recentAnalyses, activityEvents, incidents, investigations, pullRequestReviews, recoveries, agentCoordinationRuns] = await Promise.all([
      userId
        ? prisma.connectedRepository.findUnique({
            where: { userId },
          })
        : prisma.connectedRepository.findFirst({
            orderBy: { updatedAt: 'desc' },
          }),
      userId
        ? prisma.user.findUnique({
            where: { id: userId },
            select: {
              githubUsername: true,
              bobApiKey: true,
              groqApiKey: true,
              preferredAiProvider: true,
              githubWebhookSecret: true,
              autoFixEnabled: true,
              confidenceThreshold: true,
            },
          })
        : prisma.user.findFirst({
            orderBy: { updatedAt: 'desc' },
            select: {
              githubUsername: true,
              bobApiKey: true,
              groqApiKey: true,
              preferredAiProvider: true,
              githubWebhookSecret: true,
              autoFixEnabled: true,
              confidenceThreshold: true,
            },
          }),
      prisma.pullRequestAnalysis.findFirst({
        orderBy: { createdAt: 'desc' },
      }),
      prisma.pullRequestAnalysis.findMany({
        orderBy: { createdAt: 'desc' },
        take: 4,
      }),
      prisma.activityEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.incident.findMany({
        include: {
          history: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
        orderBy: { openedAt: 'desc' },
        take: 20,
      }),
      prisma.investigation.findMany({
        include: {
          steps: {
            orderBy: { startedAt: 'asc' },
          },
        },
        orderBy: { startedAt: 'desc' },
        take: 20,
      }),
      prisma.pullRequestReview.findMany({
        include: {
          steps: {
            orderBy: { startedAt: 'asc' },
          },
        },
        orderBy: { startedAt: 'desc' },
        take: 20,
      }),
      prisma.workflowRecovery.findMany({
        include: {
          steps: {
            orderBy: { startedAt: 'asc' },
          },
        },
        orderBy: { startedAt: 'desc' },
        take: 20,
      }),
      prisma.agentCoordinationRun.findMany({
        include: {
          tasks: {
            orderBy: { startedAt: 'asc' },
          },
          findings: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { startedAt: 'desc' },
        take: 20,
      }),
    ]);

    const health = await calculateRepositoryHealth(
      repository ? `${repository.owner}/${repository.repoName}` : undefined
    );
    const engineeringMemory = await getEngineeringMemorySnapshot(
      repository ? `${repository.owner}/${repository.repoName}` : undefined
    );

    return { repository, user, lastAnalysis, recentAnalyses, activityEvents, incidents, investigations, pullRequestReviews, recoveries, agentCoordinationRuns, health, engineeringMemory };
  } catch (error) {
    console.error('Dashboard database read failed', error);
    return { repository: null, user: null, lastAnalysis: null, recentAnalyses: [], activityEvents: [], incidents: [], investigations: [], pullRequestReviews: [], recoveries: [], agentCoordinationRuns: [], health: null, engineeringMemory: null };
  }
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  async function loginWithGitHub() {
    'use server';
    await signIn('github', { redirectTo: '/dashboard' });
  }

  const [params, session] = await Promise.all([searchParams, auth()]);
  const installationId = params?.installation_id;
  const setupAction = params?.setup_action;
  const { repository, user, lastAnalysis, recentAnalyses, activityEvents, incidents, investigations, pullRequestReviews, recoveries, agentCoordinationRuns, health, engineeringMemory } = await loadDashboardData(session?.user?.id);

  const authenticated = Boolean(session?.user?.id);
  const webhookConfigured = Boolean(user?.githubWebhookSecret || process.env.GITHUB_WEBHOOK_SECRET);
  const bobConnected = Boolean(user?.bobApiKey || process.env.BOB_API_KEY);
  const groqConnected = Boolean(user?.groqApiKey || process.env.GROQ_API_KEY);
  const preferredAiProvider = user?.preferredAiProvider === 'groq' ? 'groq' : 'bob';
  const confidenceThreshold = user?.confidenceThreshold ?? 80;
  const webhookUrl = `${productionUrl}/api/github/webhook`;
  const setupUrl = `${productionUrl}/api/github/setup`;

  return (
    <main className="app-shell min-h-screen p-3 sm:p-4">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_70%_100%,rgba(37,99,235,0.22),transparent_30%)]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/70 to-transparent" />

      <div className="relative mx-auto max-w-[1800px]">
        {installationId ? (
          <div className="mb-3 rounded-3xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4 text-sm text-emerald-100">
            GitHub App setup returned successfully. Installation ID:{' '}
            <span className="font-mono">{installationId}</span>
            {setupAction ? <span className="text-emerald-200/80"> · action: {setupAction}</span> : null}
          </div>
        ) : null}

        <AgentWorkspace
          authenticated={authenticated}
          repository={
            repository
              ? {
                  repoName: repository.repoName,
                  owner: repository.owner,
                  cloneUrl: repository.cloneUrl,
                  defaultBranch: repository.defaultBranch,
                }
              : null
          }
          bobConnected={bobConnected}
          groqConnected={groqConnected}
          preferredAiProvider={preferredAiProvider}
          webhookConfigured={webhookConfigured}
          autoFixEnabled={user?.autoFixEnabled ?? false}
          confidenceThreshold={confidenceThreshold}
          lastAnalysis={
            lastAnalysis
              ? {
                  prNumber: lastAnalysis.prNumber,
                  repository: lastAnalysis.repository,
                  riskScore: lastAnalysis.riskScore,
                  summary: lastAnalysis.summary,
                  createdAt: lastAnalysis.createdAt.toISOString(),
                }
              : null
          }
          recentAnalyses={recentAnalyses.map((analysis) => ({
            prNumber: analysis.prNumber,
            repository: analysis.repository,
            riskScore: analysis.riskScore,
            summary: analysis.summary,
            createdAt: analysis.createdAt.toISOString(),
          }))}
          activityEvents={activityEvents.map((event) => ({
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
          }))}
          incidents={incidents.map((incident) => ({
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
          }))}
          investigations={investigations.map((investigation) => ({
            id: investigation.id,
            investigationKey: investigation.investigationKey,
            repository: investigation.repository,
            triggerType: investigation.triggerType,
            status: investigation.status,
            currentStage: investigation.currentStage,
            severity: investigation.severity,
            confidenceLevel: investigation.confidenceLevel,
            rootCause: investigation.rootCause,
            affectedFiles: investigation.affectedFiles,
            suspiciousCommits: investigation.suspiciousCommits,
            conclusion: investigation.conclusion,
            recommendedActions: investigation.recommendedActions,
            relatedWorkflow: investigation.relatedWorkflow,
            relatedPr: investigation.relatedPr,
            startedAt: investigation.startedAt.toISOString(),
            completedAt: investigation.completedAt?.toISOString() || null,
            steps: investigation.steps.map((step) => ({
              id: step.id,
              stage: step.stage,
              status: step.status,
              summary: step.summary,
              evidence: step.evidence,
              startedAt: step.startedAt.toISOString(),
              completedAt: step.completedAt?.toISOString() || null,
            })),
          }))}
          pullRequestReviews={pullRequestReviews.map((review) => ({
            id: review.id,
            prNumber: review.prNumber,
            repository: review.repository,
            title: review.title,
            author: review.author,
            branch: review.branch,
            status: review.status,
            riskClassification: review.riskClassification,
            riskScore: review.riskScore,
            confidenceScore: review.confidenceScore,
            changedFiles: review.changedFiles,
            changedModules: review.changedModules,
            architectureImpact: review.architectureImpact,
            workflowImpact: review.workflowImpact,
            affectedDependencies: review.affectedDependencies,
            suspiciousPatterns: review.suspiciousPatterns,
            reasoning: review.reasoning,
            recommendations: review.recommendations,
            deploymentConcerns: review.deploymentConcerns,
            inlineInsights: review.inlineInsights,
            relatedUrl: review.relatedUrl,
            startedAt: review.startedAt.toISOString(),
            completedAt: review.completedAt?.toISOString() || null,
            steps: review.steps.map((step) => ({
              id: step.id,
              stage: step.stage,
              status: step.status,
              summary: step.summary,
              evidence: step.evidence,
              startedAt: step.startedAt.toISOString(),
              completedAt: step.completedAt?.toISOString() || null,
            })),
          }))}
          recoveries={recoveries.map((recovery) => ({
            id: recovery.id,
            repository: recovery.repository,
            workflowName: recovery.workflowName,
            branch: recovery.branch,
            runId: recovery.runId,
            status: recovery.status,
            strategy: recovery.strategy,
            confidenceScore: recovery.confidenceScore,
            stabilizationProbability: recovery.stabilizationProbability,
            probableRootCause: recovery.probableRootCause,
            affectedSystems: recovery.affectedSystems,
            proposedRemediation: recovery.proposedRemediation,
            operationalImpact: recovery.operationalImpact,
            validationSummary: recovery.validationSummary,
            autoFixEligible: recovery.autoFixEligible,
            autoFixExecuted: recovery.autoFixExecuted,
            recoveryPullRequestUrl: recovery.recoveryPullRequestUrl,
            startedAt: recovery.startedAt.toISOString(),
            completedAt: recovery.completedAt?.toISOString() || null,
            steps: recovery.steps.map((step) => ({
              id: step.id,
              stage: step.stage,
              status: step.status,
              summary: step.summary,
              evidence: step.evidence,
              startedAt: step.startedAt.toISOString(),
              completedAt: step.completedAt?.toISOString() || null,
            })),
          }))}
          agentCoordinationRuns={agentCoordinationRuns.map((run) => ({
            id: run.id,
            runKey: run.runKey,
            repository: run.repository,
            triggerType: run.triggerType,
            status: run.status,
            priority: run.priority,
            activeAgent: run.activeAgent,
            combinedConclusion: run.combinedConclusion,
            operationalSummary: run.operationalSummary,
            linkedWorkflow: run.linkedWorkflow,
            linkedIncidentKey: run.linkedIncidentKey,
            startedAt: run.startedAt.toISOString(),
            completedAt: run.completedAt?.toISOString() || null,
            tasks: run.tasks.map((task) => ({
              id: task.id,
              agentType: task.agentType,
              title: task.title,
              status: task.status,
              priority: task.priority,
              summary: task.summary,
              context: task.context,
              startedAt: task.startedAt.toISOString(),
              completedAt: task.completedAt?.toISOString() || null,
            })),
            findings: run.findings.map((finding) => ({
              id: finding.id,
              agentType: finding.agentType,
              findingType: finding.findingType,
              severity: finding.severity,
              summary: finding.summary,
              evidence: finding.evidence,
              confidence: finding.confidence,
              createdAt: finding.createdAt.toISOString(),
            })),
          }))}
          engineeringMemory={engineeringMemory ? {
            repository: engineeringMemory.repository,
            memories: engineeringMemory.memories.map((memory) => ({
              ...memory,
              lastSeenAt: memory.lastSeenAt.toISOString(),
            })),
            nodes: engineeringMemory.nodes,
            edges: engineeringMemory.edges,
            insights: engineeringMemory.insights,
            stats: engineeringMemory.stats,
          } : null}
          health={health ? {
            repository: health.repository,
            healthScore: health.healthScore,
            status: health.status,
            workflowFailures: health.workflowFailures,
            regressionIncidents: health.regressionIncidents,
            failedPullRequests: health.failedPullRequests,
            suspiciousCommits: health.suspiciousCommits,
            unresolvedIssues: health.unresolvedIssues,
            autoFixSuccesses: health.autoFixSuccesses,
            autoFixFailures: health.autoFixFailures,
            workflowReliability: health.workflowReliability,
            autoFixSuccessRate: health.autoFixSuccessRate,
            stabilityTrend: health.stabilityTrend,
          } : null}
          loginAction={loginWithGitHub}
          githubAppInstallUrl={githubAppInstallUrl}
          webhookUrl={webhookUrl}
          setupUrl={setupUrl}
        />
      </div>
    </main>
  );
}

// Made with Bob
// made by bob
