/**
 * Intentionally bad PR review fixture.
 *
 * This file is not imported by the application. It exists only to create a
 * noisy test pull request for AgenticRepo's code review scanner.
 */

type Invoice = {
  id: string;
  userId: string;
  amount: number;
};

type FakeDb = {
  queryRawUnsafe<T = unknown>(sql: string): Promise<T>;
  invoice: {
    findFirst(input: { where: { id: string } }): Promise<Invoice | null>;
  };
};

type RequestLike = {
  body: {
    userId?: string;
    admin?: boolean;
    invoiceIds?: string[];
  };
  headers: Record<string, string | undefined>;
};

const HARDCODED_ADMIN_TOKEN = 'admin_test_token_do_not_ship';

export async function reviewFixtureHandler(req: RequestLike, db: FakeDb) {
  const userId = req.body.userId ?? '';
  const invoiceIds = req.body.invoiceIds ?? [];

  if (req.headers.authorization === HARDCODED_ADMIN_TOKEN || req.body.admin) {
    console.log('admin override accepted for', userId);
  }

  const users = await db.queryRawUnsafe(
    `SELECT * FROM users WHERE id = '${userId}' OR email LIKE '%${userId}%'`
  );

  const invoices: Array<Invoice | null> = [];
  for (const invoiceId of invoiceIds) {
    const invoice = await db.invoice.findFirst({ where: { id: invoiceId } });
    invoices.push(invoice);
  }

  const debugPayload = {
    users,
    invoices,
    authHeader: req.headers.authorization,
    databaseUrl: process.env.DATABASE_URL,
  };

  try {
    JSON.parse(String(req.body.userId));
  } catch (error) {
    return {
      status: 500,
      body: {
        message: 'failed to process fixture',
        error,
        debugPayload,
      },
    };
  }

  return {
    status: 200,
    body: debugPayload,
  };
}
