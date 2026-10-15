import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { buildTestApp } from '../support/build-test-app.js';
import { createTestPool, resetData } from '../support/db.js';
import { startJwks, type JwksFixture } from '../support/jwks-server.js';

const ALICE = '11111111-1111-4111-8111-111111111111';

describe('flujo interno de pagos', () => {
  let pool: Pool;
  let jwks: JwksFixture;
  let app: FastifyInstance;

  beforeAll(async () => {
    pool = createTestPool();
    jwks = await startJwks();
    app = await buildTestApp(pool, jwks.url);
  });

  beforeEach(async () => {
    await resetData(pool);
  });

  afterAll(async () => {
    await app.close();
    await jwks.close();
    await pool.end();
  });

  it('lista cuentas, transfiere, consulta estado e historial y deja el outbox', async () => {
    const token = await jwks.token(ALICE);
    const headers = { authorization: `Bearer ${token}` };

    const accounts = await app.inject({ method: 'GET', url: '/accounts', headers });
    expect(accounts.statusCode).toBe(200);
    expect(accounts.json()).toEqual([{ id: 'ACC-001', currency: 'COP', balance: '1000000.00' }]);

    const balance = await app.inject({ method: 'GET', url: '/accounts/ACC-001/balance', headers });
    expect(balance.statusCode).toBe(200);
    expect(balance.json()).toEqual({ accountId: 'ACC-001', currency: 'COP', balance: '1000000.00' });

    const created = await app.inject({
      method: 'POST',
      url: '/transfers',
      headers: { ...headers, 'idempotency-key': 'internal-flow-1', 'content-type': 'application/json' },
      payload: { type: 'INTERNAL', fromAccountId: 'ACC-001', toAccountId: 'ACC-002', amount: '150.50' },
    });
    expect(created.statusCode).toBe(201);
    const transfer = created.json<{ id: string; status: string; amount: string; toAccountId: string }>();
    expect(transfer.status).toBe('COMPLETED');
    expect(transfer.amount).toBe('150.50');
    expect(transfer.toAccountId).toBe('ACC-002');

    const replay = await app.inject({
      method: 'POST',
      url: '/transfers',
      headers: { ...headers, 'idempotency-key': 'internal-flow-1', 'content-type': 'application/json' },
      payload: { type: 'INTERNAL', fromAccountId: 'ACC-001', toAccountId: 'ACC-002', amount: '150.50' },
    });
    expect(replay.statusCode).toBe(201);
    expect(replay.headers['idempotent-replayed']).toBe('true');
    expect(replay.json()).toEqual(created.json());

    const detail = await app.inject({ method: 'GET', url: `/transfers/${transfer.id}`, headers });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({ id: transfer.id, status: 'COMPLETED', reversal: null });

    const history = await app.inject({ method: 'GET', url: '/transfers', headers });
    expect(history.statusCode).toBe(200);
    expect(history.json<{ items: { id: string }[] }>().items.map((item) => item.id)).toContain(transfer.id);

    const balances = await pool.query<{ id: string; balance: string }>(
      `SELECT id, balance::text AS balance FROM payment_schema.accounts WHERE id IN ('ACC-001', 'ACC-002') ORDER BY id`,
    );
    expect(balances.rows).toEqual([
      { id: 'ACC-001', balance: '999849.50' },
      { id: 'ACC-002', balance: '500150.50' },
    ]);

    const outbox = await pool.query<{ event_type: string }>(
      `SELECT event_type FROM payment_schema.outbox_events WHERE aggregate_id = $1 ORDER BY created_at, id`,
      [transfer.id],
    );
    expect(outbox.rows.map((row) => row.event_type)).toEqual(['transfer.created', 'transfer.completed']);
  });
});
