import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, testConfig } from '../support/build-test-app.js';
import { createTestPool, truncateAll } from '../support/db.js';

const DEMO = [
  { id: '11111111-1111-4111-8111-111111111111', email: 'alice@fluxone.test' },
  { id: '22222222-2222-4222-8222-222222222222', email: 'bob@fluxone.test' },
  { id: '33333333-3333-4333-8333-333333333333', email: 'carol@fluxone.test' },
];

describe('Semilla de usuarios demo', () => {
  let pool: pg.Pool;
  const apps: FastifyInstance[] = [];

  async function startApp(): Promise<FastifyInstance> {
    const app = await buildTestApp(pool);
    apps.push(app);
    return app;
  }

  async function demoRows() {
    const { rows } = await pool.query(
      'SELECT id, email, password_hash, created_at, updated_at FROM auth_schema.users ORDER BY id',
    );
    return rows;
  }

  beforeAll(() => {
    pool = createTestPool();
  });

  beforeEach(async () => {
    await truncateAll(pool);
  });

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  afterAll(async () => {
    await pool.end();
  });

  it('[AC-AUT-21] arrancar dos veces deja exactamente 3 usuarios demo con ids fijos, sin modificar a los existentes', async () => {
    await startApp();
    const afterFirst = await demoRows();
    expect(afterFirst.map(({ id, email }) => ({ id, email }))).toEqual(DEMO);

    const second = await startApp();

    const afterSecond = await demoRows();
    expect(afterSecond).toHaveLength(3);
    expect(afterSecond).toEqual(afterFirst); // mismos hashes y marcas de tiempo: nada se sobrescribe

    // alice, bob y carol inician sesión con DEMO_USERS_PASSWORD.
    for (const demo of DEMO) {
      const response = await second.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: demo.email, password: testConfig().demoUsersPassword },
      });
      expect(response.statusCode, demo.email).toBe(200);
      expect(response.json().user).toEqual(demo);
    }
  });

  it('[AC-AUT-21] un usuario demo preexistente no se modifica al arrancar', async () => {
    const first = await startApp();
    await first.close();
    apps.length = 0;
    await pool.query(
      `UPDATE auth_schema.users SET password_hash = 'hash-preexistente' WHERE id = $1`,
      [DEMO[0]?.id],
    );

    await startApp();

    const { rows } = await pool.query('SELECT password_hash FROM auth_schema.users WHERE id = $1', [
      DEMO[0]?.id,
    ]);
    expect(rows[0].password_hash).toBe('hash-preexistente');
    expect(await demoRows()).toHaveLength(3);
  });
});
