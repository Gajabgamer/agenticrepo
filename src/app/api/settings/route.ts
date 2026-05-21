import { auth } from '../../../../auth';
import { logActivityEvent } from '@/lib/activity/logActivityEvent';
import { getPrisma } from '@/lib/database/prisma';
import { encryptSecret } from '@/lib/security/secrets';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await getPrisma().user.findUnique({
    where: { id: session.user.id },
    select: {
      bobApiKey: true,
      groqApiKey: true,
      preferredAiProvider: true,
      githubWebhookSecret: true,
      autoFixEnabled: true,
      confidenceThreshold: true,
    },
  });

  return Response.json({
    settings: {
      hasBobApiKey: Boolean(user?.bobApiKey || process.env.BOB_API_KEY),
      hasGroqApiKey: Boolean(user?.groqApiKey || process.env.GROQ_API_KEY),
      preferredAiProvider: user?.preferredAiProvider ?? 'bob',
      hasGithubWebhookSecret: Boolean(user?.githubWebhookSecret),
      autoFixEnabled: user?.autoFixEnabled ?? false,
      confidenceThreshold: user?.confidenceThreshold ?? 80,
    },
  });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json() as {
    bobApiKey?: string;
    groqApiKey?: string;
    preferredAiProvider?: string;
    githubWebhookSecret?: string;
    autoFixEnabled?: boolean;
    confidenceThreshold?: number;
  };

  const preferredAiProvider = body.preferredAiProvider === 'groq' ? 'groq' : 'bob';
  const confidenceThreshold = Math.min(
    100,
    Math.max(0, Number(body.confidenceThreshold ?? 80))
  );

  await getPrisma().user.update({
    where: { id: session.user.id },
    data: {
      autoFixEnabled: Boolean(body.autoFixEnabled),
      confidenceThreshold,
      preferredAiProvider,
      ...(body.bobApiKey?.trim()
        ? { bobApiKey: encryptSecret(body.bobApiKey.trim()) }
        : {}),
      ...(body.groqApiKey?.trim()
        ? { groqApiKey: encryptSecret(body.groqApiKey.trim()) }
        : {}),
      ...(body.githubWebhookSecret?.trim()
        ? { githubWebhookSecret: encryptSecret(body.githubWebhookSecret.trim()) }
        : {}),
    },
  });

  await logActivityEvent({
    eventType: 'ai_analysis',
    repository: 'agent-settings',
    severity: 'success',
    status: 'completed',
    summary: `${preferredAiProvider === 'groq' ? 'Groq' : 'IBM Bob'} provider settings updated`,
    details: {
      preferredAiProvider,
      autoFixEnabled: Boolean(body.autoFixEnabled),
      confidenceThreshold,
      bobKeyUpdated: Boolean(body.bobApiKey?.trim()),
      groqKeyUpdated: Boolean(body.groqApiKey?.trim()),
      webhookSecretUpdated: Boolean(body.githubWebhookSecret?.trim()),
    },
  });

  return Response.json({ success: true });
}

// Made with Bob
// made by bob
