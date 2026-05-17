import 'dotenv/config';
import { createHash, randomUUID } from 'crypto';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { createClient } from '@libsql/client';

const migrationsPath = join(process.cwd(), 'prisma', 'migrations');

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

async function main() {
  const client = createClient({
    url: getRequiredEnv('DATABASE_URL'),
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });

  await client.execute(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "checksum" TEXT NOT NULL,
      "finished_at" DATETIME,
      "migration_name" TEXT NOT NULL,
      "logs" TEXT,
      "rolled_back_at" DATETIME,
      "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    )
  `);

  const existingResult = await client.execute('SELECT "migration_name" FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL');
  const existingMigrations = new Set(existingResult.rows.map((row) => String(row.migration_name)));
  const migrationNames = (await readdir(migrationsPath, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const migrationName of migrationNames) {
    if (existingMigrations.has(migrationName)) {
      console.log(`Skipping applied migration: ${migrationName}`);
      continue;
    }

    const sql = await readFile(join(migrationsPath, migrationName, 'migration.sql'), 'utf8');
    const statements = splitSqlStatements(sql);
    const checksum = createHash('sha256').update(sql).digest('hex');
    const migrationId = randomUUID();

    console.log(`Applying migration: ${migrationName}`);
    await client.execute({
      sql: 'INSERT INTO "_prisma_migrations" ("id", "checksum", "migration_name", "applied_steps_count") VALUES (?, ?, ?, 0)',
      args: [migrationId, checksum, migrationName],
    });

    let appliedSteps = 0;
    try {
      for (const statement of statements) {
        await client.execute(statement);
        appliedSteps += 1;
      }

      await client.execute({
        sql: 'UPDATE "_prisma_migrations" SET "finished_at" = CURRENT_TIMESTAMP, "applied_steps_count" = ? WHERE "id" = ?',
        args: [appliedSteps, migrationId],
      });
    } catch (error) {
      await client.execute({
        sql: 'UPDATE "_prisma_migrations" SET "logs" = ? WHERE "id" = ?',
        args: [error instanceof Error ? error.message : 'Unknown migration error', migrationId],
      });
      throw error;
    }
  }

  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// Made with Bob
// made by bob
