import pg from 'pg';

export function createTestPool(): pg.Pool {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

export async function truncateAll(pool: pg.Pool): Promise<void> {
  await pool.query(
    'TRUNCATE auth_schema.refresh_tokens, auth_schema.users, auth_schema.signing_keys CASCADE',
  );
}
