// adapter: out — node-pg-migrate (migraciones SQL de payment_schema)
import path from 'node:path';
import { runner } from 'node-pg-migrate';

export async function runMigrations(databaseUrl: string): Promise<void> {
  await runner({
    databaseUrl,
    dir: path.resolve(import.meta.dirname, '../../../../migrations'),
    direction: 'up',
    schema: 'payment_schema',
    createSchema: false,
    migrationsTable: 'pgmigrations',
  });
}
