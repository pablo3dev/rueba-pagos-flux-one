// adapter: out — pg (pool de conexiones)
import { Pool } from 'pg';

export function createPool(databaseUrl: string): Pool {
  const pool = new Pool({ connectionString: databaseUrl, max: 10 });
  pool.on('error', (error) => {
    process.stderr.write(`${JSON.stringify({ level: 'error', event: 'pg.pool_error', message: error.message })}\n`);
  });
  return pool;
}
