// adapter: out — pg Pool hacia PostgreSQL (rol auth_svc, esquema auth_schema)
import { Pool } from 'pg';

export function createPool(databaseUrl: string): Pool {
  return new Pool({ connectionString: databaseUrl });
}
