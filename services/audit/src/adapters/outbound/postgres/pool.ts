// adapter: out — pg Pool hacia PostgreSQL (rol audit_svc, esquema audit_schema)
import { Pool } from 'pg';

export function createPool(databaseUrl: string): Pool {
  return new Pool({ connectionString: databaseUrl });
}
