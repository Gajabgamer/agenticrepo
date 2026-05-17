import { auth, signIn } from '../../../auth';
import { getPrisma } from '@/lib/database/prisma';
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

    const [repository, user, lastAnalysis, recentAnalyses] = await Promise.all([
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
    ]);

    return { repository, user, lastAnalysis, recentAnalyses };
  } catch (error) {
    console.error('Dashboard database read failed', error);
    return { repository: null, user: null, lastAnalysis: null, recentAnalyses: [] };
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
  const { repository, user, lastAnalysis, recentAnalyses } = await loadDashboardData(session?.user?.id);

  const authenticated = Boolean(session?.user?.id);
  const webhookConfigured = Boolean(user?.githubWebhookSecret || process.env.GITHUB_WEBHOOK_SECRET);
  const bobConnected = Boolean(user?.bobApiKey || process.env.BOB_API_KEY);
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
