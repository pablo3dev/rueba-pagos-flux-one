import { composeApp } from './compose.js';
import { loadConfig } from './config.js';

async function start(): Promise<void> {
  const config = loadConfig(process.env);
  const app = await composeApp({ config });
  let closing: Promise<void> | undefined;
  const shutdown = (): void => {
    closing ??= app.close().then(
      () => undefined,
      (error: unknown) => {
        process.stderr.write(`${errorMessage(error)}\n`);
        process.exit(1);
      },
    );
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  await app.listen({ host: '0.0.0.0', port: config.port });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

start().catch((error: unknown) => {
  process.stderr.write(`${errorMessage(error)}\n`);
  process.exit(1);
});
