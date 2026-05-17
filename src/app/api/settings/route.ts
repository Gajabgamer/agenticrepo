import { auth } from '../../../../auth';
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
      githubWebhookSecret: true,
      autoFixEnabled: true,
      confidenceThreshold: true,
    },
  });

  return Response.json({
    settings: {
      hasBobApiKey: Boolean(user?.bobApiKey),
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
    githubWebhookSecret?: string;
    autoFixEnabled?: boolean;
    confidenceThreshold?: number;
  };

  const confidenceThreshold = Math.min(
    100,
    Math.max(0, Number(body.confidenceThreshold ?? 80))
  );

  await getPrisma().user.update({
    where: { id: session.user.id },
    data: {
      autoFixEnabled: Boolean(body.autoFixEnabled),
      confidenceThreshold,
      ...(body.bobApiKey?.trim()
        ? { bobApiKey: encryptSecret(body.bobApiKey.trim()) }
        : {}),
      ...(body.githubWebhookSecret?.trim()
        ? { githubWebhookSecret: encryptSecret(body.githubWebhookSecret.trim()) }
        : {}),
    },
  });

  return Response.json({ success: true });
}

// Made with Bob
// made by bob
