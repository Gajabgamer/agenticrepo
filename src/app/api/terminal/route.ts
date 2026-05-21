import { auth } from '../../../../auth';
import { logActivityEvent } from '@/lib/activity/logActivityEvent';
import { getPrisma } from '@/lib/database/prisma';
import { incidentKey, upsertIncident } from '@/lib/incidents/incidentManager';
import {
  executeTerminalCommand,
  isAllowedTerminalCommand,
  parseTerminalCommand,
  terminalCommands,
} from '@/lib/terminal/commandRouter';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json() as { command?: string };
  const parsed = parseTerminalCommand(body.command || '');

  if (!parsed.command || !isAllowedTerminalCommand(parsed.command)) {
    return Response.json({
      lines: [
        terminalLine('danger', 'AgenticRepo', `Command not allowed: ${body.command || '(empty)'}`),
        terminalLine('muted', 'AgenticRepo', `Supported commands: ${terminalCommands.join(', ')}`),
      ],
    });
  }

  const prisma = getPrisma();
  const [repository, user, recentAnalyses, recentReviews, recentRecoveries, recentMemories, recentCoordinationRuns, recentEvents] = await Promise.all([
    prisma.connectedRepository.findUnique({
      where: { userId: session.user.id },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        bobApiKey: true,
        groqApiKey: true,
        preferredAiProvider: true,
        githubWebhookSecret: true,
        autoFixEnabled: true,
        confidenceThreshold: true,
      },
    }),
    prisma.pullRequestAnalysis.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    prisma.pullRequestReview.findMany({
      orderBy: { startedAt: 'desc' },
      take: 8,
    }),
    prisma.workflowRecovery.findMany({
      orderBy: { startedAt: 'desc' },
      take: 8,
    }),
    prisma.engineeringMemory.findMany({
      orderBy: { lastSeenAt: 'desc' },
      take: 12,
    }),
    prisma.agentCoordinationRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 8,
    }),
    prisma.githubEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
  ]);

  const lines = await executeTerminalCommand({
    command: parsed.command,
    args: parsed.args,
    repository,
    user,
    userId: session.user.id,
    recentAnalyses,
    recentReviews,
    recentRecoveries,
    recentMemories,
    recentCoordinationRuns,
    recentEvents,
  });

  await logActivityEvent({
    eventType: parsed.command === 'generate-docs' ? 'documentation_generation' : parsed.command === 'review-pr' ? 'pr_review' : ['recover-workflow', 'stabilize-repo', 'self-heal'].includes(parsed.command) ? 'workflow_recovery' : ['memory-status', 'engineering-insights'].includes(parsed.command) ? 'engineering_memory' : ['context-sources', 'optimize-context', 'recent-investigations', 'repo-memory', 'token-usage'].includes(parsed.command) ? 'context_optimization' : ['show-agents', 'active-investigations', 'coordination-status', 'assign-analysis', 'engineering-network', 'investigation-flow'].includes(parsed.command) ? 'agent_coordination' : 'terminal_command',
    repository: repository ? `${repository.owner}/${repository.repoName}` : 'no repository connected',
    severity: 'info',
    status: 'completed',
    summary: `Terminal command executed: ${parsed.command}`,
    details: {
      args: parsed.args,
      lineCount: lines.length,
    },
  });

  if (['investigate-failure', 'scan-regressions', 'correlate-commits'].includes(parsed.command)) {
    await upsertIncident({
      incidentKey: incidentKey(['terminal', parsed.command, repository?.owner, repository?.repoName]),
      severity: parsed.command === 'investigate-failure' ? 'MEDIUM' : 'LOW',
      repository: repository ? `${repository.owner}/${repository.repoName}` : 'no repository connected',
      affectedBranch: repository?.defaultBranch,
      engineeringSummary: `Terminal investigation command executed: ${parsed.command}`,
      status: parsed.command === 'investigate-failure' ? 'INVESTIGATING' : 'ANALYZING',
      historySummary: `Terminal initiated ${parsed.command}`,
      historyDetails: {
        args: parsed.args,
        lineCount: lines.length,
      },
    });
  }

  return Response.json({ lines });
}

// made by bob
function terminalLine(
  tone: 'info' | 'success' | 'warning' | 'danger' | 'muted',
  badge: 'AgenticRepo',
  text: string
) {
  return {
    tone,
    badge,
    text,
    timestamp: new Date().toISOString(),
  };
}

// Made with Bob
// made by bob
