import { runMigrations } from '../src/adapters/outbound/postgres/migrate.js';

export default async function setup(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL no definida: ejecuta las pruebas con docker compose run dev');
  }
  await runMigrations(databaseUrl);
}
