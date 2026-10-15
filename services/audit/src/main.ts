// Arranque del proceso: config → migraciones → pool → broker → listen → cierre ordenado.
import { runMigrations } from './adapters/outbound/postgres/migrate.js';
import { createPool } from './adapters/outbound/postgres/pool.js';
import { composeApp } from './compose.js';
import { loadConfig } from './config.js';

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  await runMigrations(config.databaseUrl);
  const pool = createPool(config.databaseUrl);
  const { app, broker } = await composeApp({ config, pool });
  await broker.start();
  await app.listen({ host: '0.0.0.0', port: config.port });

  let closing = false;
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      if (closing) return;
      closing = true;
      void (async () => {
        await broker.stop();
        await app.close();
        await pool.end();
        process.exit(0);
      })();
    });
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'error desconocido';
  console.error(JSON.stringify({ level: 'fatal', msg: 'startup failed', error: message }));
  process.exit(1);
});
