import { composeApp, composeWorkers } from './compose.js';
import { loadConfig } from './config.js';
import { createPool } from './adapters/outbound/postgres/pool.js';
import { runMigrations } from './adapters/outbound/postgres/migrate.js';

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  await runMigrations(config.databaseUrl);
  const pool = createPool(config.databaseUrl);
  const app = await composeApp({ config, pool });
  const workers = composeWorkers({ config, pool, logger: app.log });
  await app.listen({ host: '0.0.0.0', port: config.port });
  workers.start();
  const shutdown = async (): Promise<void> => {
    await workers.stop();
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'arranque fallido';
  process.stderr.write(`${JSON.stringify({ level: 'error', message })}\n`);
  process.exit(1);
});
