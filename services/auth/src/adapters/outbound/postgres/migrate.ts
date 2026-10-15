// adapter: out — node-pg-migrate (migraciones SQL de auth_schema; idempotente por pgmigrations)
import path from 'node:path';
import { runner } from 'node-pg-migrate';

// `../../../../migrations` resuelve a migrations/ en la raíz de la unidad desde src/ y desde dist/.
export async function runMigrations(databaseUrl: string): Promise<void> {
  await runner({
    databaseUrl,
    dir: path.resolve(import.meta.dirname, '../../../../migrations'),
    direction: 'up',
    schema: 'auth_schema',
    createSchema: false,
    migrationsTable: 'pgmigrations',
  });
}
