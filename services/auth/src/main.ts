// Arranque del proceso: config → migraciones → pool → composición → listen → cierre ordenado.
import { runMigrations } from './adapters/outbound/postgres/migrate.js';
import { createPool } from './adapters/outbound/postgres/pool.js';
import { composeApp } from './compose.js';
import { loadConfig } from './config.js';

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  await runMigrations(config.databaseUrl);
  const pool = createPool(config.databaseUrl);
  const app = await composeApp({ config, pool });
  await app.listen({ host: '0.0.0.0', port: config.port });

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      void (async () => {
        await app.close();
        await pool.end();
        process.exit(0);
      })();
    });
  }
}

main().catch((error: unknown) => {
  // Solo el mensaje: nunca el objeto completo (podría arrastrar configuración o secretos).
  const message = error instanceof Error ? error.message : 'error desconocido';
  console.error(JSON.stringify({ level: 'fatal', msg: 'startup failed', error: message }));
  process.exit(1);
});
