import path from 'node:path';
import { runner } from 'node-pg-migrate';

// Migra la PostgreSQL del servicio `postgres` de Compose con los mismos parámetros que producción.
// No inicia contenedores ni crea esquema o rol (los provee el script de inicialización de Compose).
export default async function setup(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL no definida: ejecuta las pruebas con docker compose run dev');
  }

  await runner({
    databaseUrl,
    dir: path.resolve(import.meta.dirname, '../migrations'),
    direction: 'up',
    schema: 'auth_schema',
    createSchema: false,
    migrationsTable: 'pgmigrations',
  });
}
