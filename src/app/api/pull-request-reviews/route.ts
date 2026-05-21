import { auth } from '../../../../auth';
import { getPrisma } from '@/lib/database/prisma';
import { runAutonomousPullRequestReviewForUser } from '@/lib/pr-review/prReviewEngine';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const reviews = await getPrisma().pullRequestReview.findMany({
    include: {
      steps: {
        orderBy: { startedAt: 'asc' },
      },
    },
    orderBy: { startedAt: 'desc' },
    take: 20,
  });

  return Response.json({ reviews });
}

// made by bob
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json() as { prNumber?: number };

  if (!body.prNumber || Number.isNaN(Number(body.prNumber))) {
    return Response.json({ error: 'A numeric prNumber is required.' }, { status: 400 });
  }

  const review = await runAutonomousPullRequestReviewForUser({
    userId: session.user.id,
    prNumber: Number(body.prNumber),
  });

  return Response.json({ review });
}

// Made with Bob
// made by bob
