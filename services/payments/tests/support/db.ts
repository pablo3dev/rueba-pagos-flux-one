import { Pool } from 'pg';

export function createTestPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL no definida: ejecuta las pruebas con docker compose run dev');
  return new Pool({ connectionString: databaseUrl, max: 5 });
}

export async function resetData(pool: Pool): Promise<void> {
  await pool.query(
    `TRUNCATE payment_schema.outbox_events, payment_schema.reversals, payment_schema.idempotency_keys, payment_schema.transfers`,
  );
  await pool.query(
    `UPDATE payment_schema.accounts SET balance = CASE id
       WHEN 'ACC-001' THEN 1000000.00
       WHEN 'ACC-002' THEN 500000.00
       WHEN 'ACC-003' THEN 0.00
       ELSE balance
     END, updated_at = now()`,
  );
}
