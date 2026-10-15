import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from '../support/build-test-app.js';
import { createTestPool, truncateAll } from '../support/db.js';

const ALICE = { email: 'alice@fluxone.test', password: 'demo_password_123' };
const ALICE_ID = '11111111-1111-4111-8111-111111111111';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const INVALID = {
  error: { code: 'REFRESH_TOKEN_INVALID', message: 'La sesión no es válida o expiró.' },
};
const REUSED = {
  error: {
    code: 'REFRESH_TOKEN_REUSED',
    message: 'La sesión fue revocada por seguridad. Inicia sesión de nuevo.',
  },
};

// `name=value` de la cabecera Set-Cookie, tal como el navegador lo reenviaría.
function cookiePair(setCookie: string | string[] | undefined): string {
  const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return (header as string).split(';')[0] as string;
}

// Token opaco (sin la firma) que contiene un par `refresh_token=<token>.<firma>`.
function opaqueToken(pair: string): string {
  const value = decodeURIComponent(pair.slice('refresh_token='.length));
  return value.slice(0, value.lastIndexOf('.'));
}

describe('POST /auth/refresh', () => {
  let pool: pg.Pool;
  let app: FastifyInstance;

  function refresh(cookie?: string) {
    return app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: cookie === undefined ? {} : { cookie },
    });
  }

  async function loginCookie(): Promise<string> {
    const response = await app.inject({ method: 'POST', url: '/auth/login', payload: ALICE });
    expect(response.statusCode).toBe(200);
    return cookiePair(response.headers['set-cookie']);
  }

  beforeAll(() => {
    pool = createTestPool();
  });

  beforeEach(async () => {
    await truncateAll(pool);
    app = await buildTestApp(pool);
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('[AC-AUT-11] una renovación válida responde 200, rota la cookie e inutiliza la anterior', async () => {
    const first = await loginCookie();

    const response = await refresh(first);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      accessToken: expect.any(String),
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { id: ALICE_ID, email: ALICE.email },
    });
    expect(response.json()).not.toHaveProperty('refreshToken');
    const setCookie = response.headers['set-cookie'] as string;
    const second = cookiePair(setCookie);
    expect(second).toMatch(/^refresh_token=[^;]+\./);
    expect(second).not.toBe(first);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');
    expect(setCookie).toContain('Path=/api/auth');
    expect(setCookie).toContain('Max-Age=604800');
    expect(opaqueToken(second)).not.toContain(response.json().accessToken);

    // La cookie anterior ya no sirve (esto además revoca la familia por reutilización).
    expect((await refresh(first)).statusCode).toBe(401);
  });

  it('[AC-AUT-11] dos renovaciones simultáneas con el mismo token: una 200 y otra 401 REFRESH_TOKEN_REUSED', async () => {
    const cookie = await loginCookie();

    const responses = await Promise.all([refresh(cookie), refresh(cookie)]);

    const statuses = responses.map((r) => r.statusCode).sort();
    expect(statuses).toEqual([200, 401]);
    const rejected = responses.find((r) => r.statusCode === 401);
    expect(rejected?.json()).toEqual(REUSED);
    const { rows } = await pool.query(
      'SELECT count(*)::int AS total FROM auth_schema.refresh_tokens WHERE revoked_at IS NULL',
    );
    expect(rows[0].total).toBe(0); // la reutilización detectada revocó toda la familia
  });

  it('[AC-AUT-12] la reutilización revoca toda la familia: el token sucesor deja de servir y responde 401 REFRESH_TOKEN_REUSED', async () => {
    const first = await loginCookie();
    const rotated = await refresh(first);
    expect(rotated.statusCode).toBe(200);
    const successor = cookiePair(rotated.headers['set-cookie']);

    const reuse = await refresh(first);

    expect(reuse.statusCode).toBe(401);
    expect(reuse.json()).toEqual(REUSED);
    const { rows } = await pool.query(
      'SELECT revoked_at FROM auth_schema.refresh_tokens WHERE user_id = $1',
      [ALICE_ID],
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.revoked_at !== null)).toBe(true);

    const successorAttempt = await refresh(successor);
    expect(successorAttempt.statusCode).toBe(401);
    expect(successorAttempt.json()).toEqual(REUSED);
  });

  it('[AC-AUT-12] la reutilización registra auth.refresh_reuse_detected con userId y familyId, sin el token', async () => {
    const lines: string[] = [];
    await app.close();
    app = await buildTestApp(pool, {
      config: { logLevel: 'info' },
      logStream: { write: (message) => lines.push(message) },
    });
    const first = await loginCookie();
    await refresh(first);

    await refresh(first);

    const events = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    const event = events.find((e) => e.event === 'auth.refresh_reuse_detected');
    expect(event).toMatchObject({ level: 40, userId: ALICE_ID, familyId: expect.any(String) });
    expect(lines.join('')).not.toContain(opaqueToken(first));
  });

  it('[AC-AUT-13] cookie ausente, alterada, desconocida y expirada responden 401 REFRESH_TOKEN_INVALID y limpian la cookie', async () => {
    const valid = await loginCookie();
    const value = decodeURIComponent(valid.slice('refresh_token='.length));
    const token = value.slice(0, value.lastIndexOf('.'));
    const signature = value.slice(value.lastIndexOf('.') + 1);
    const forgedSignature = `refresh_token=${encodeURIComponent(`${token}.${'A'.repeat(signature.length)}`)}`;
    const forgedToken = `refresh_token=${encodeURIComponent(`${token.slice(1)}X.${signature}`)}`;
    const unknown = `refresh_token=${encodeURIComponent(app.signCookie('valor-desconocido'))}`;
    const unsigned = `refresh_token=${encodeURIComponent(token)}`;

    // Expirada: la fila existe, pero su expires_at ya pasó (cookie legítima con firma válida).
    await pool.query(
      `UPDATE auth_schema.refresh_tokens SET expires_at = now() - interval '1 minute'
       WHERE token_hash = $1`,
      [createHash('sha256').update(token).digest('hex')],
    );

    const cases: Array<[string, string | undefined]> = [
      ['cookie ausente', undefined],
      ['firma alterada', forgedSignature],
      ['token alterado con la firma original', forgedToken],
      ['valor sin firma', unsigned],
      ['token desconocido con firma válida', unknown],
      ['token expirado', valid],
    ];
    for (const [label, cookie] of cases) {
      const response = await refresh(cookie);
      expect(response.statusCode, label).toBe(401);
      expect(response.json(), label).toEqual(INVALID);
      const setCookie = response.headers['set-cookie'] as string;
      expect(setCookie, label).toMatch(/^refresh_token=;/);
      expect(setCookie, label).toContain('Path=/api/auth');
      expect(setCookie, label).toMatch(/Expires=Thu, 01 Jan 1970/);
    }
  });

  it('[AC-AUT-13] un token expirado no se rota: no se crea ninguna fila sucesora', async () => {
    const valid = await loginCookie();
    await pool.query(
      `UPDATE auth_schema.refresh_tokens SET expires_at = now() - interval '1 second'`,
    );

    const response = await refresh(valid);

    expect(response.statusCode).toBe(401);
    const { rows } = await pool.query(
      'SELECT count(*)::int AS total, count(revoked_at)::int AS revoked FROM auth_schema.refresh_tokens',
    );
    expect(rows[0]).toEqual({ total: 1, revoked: 0 });
  });

  it('[AC-AUT-14] la base solo guarda el SHA-256 del token y expires_at = emisión + 7 días', async () => {
    const before = Date.now();
    const first = await loginCookie();
    const rotated = await refresh(first);
    const after = Date.now();
    const second = cookiePair(rotated.headers['set-cookie']);
    expect(rotated.statusCode).toBe(200);

    const { rows } = await pool.query(
      'SELECT * FROM auth_schema.refresh_tokens ORDER BY created_at ASC',
    );
    expect(rows).toHaveLength(2);
    const stored = JSON.stringify(rows);
    for (const pair of [first, second]) {
      const token = opaqueToken(pair);
      expect(stored).not.toContain(token);
      expect(stored).not.toContain(decodeURIComponent(pair.slice('refresh_token='.length)));
      const hash = createHash('sha256').update(token).digest('hex');
      expect(rows.map((row) => row.token_hash)).toContain(hash);
    }
    for (const row of rows) {
      expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
      const issuedAt = (row.created_at as Date).getTime();
      expect(issuedAt).toBeGreaterThanOrEqual(before - 1000);
      expect(issuedAt).toBeLessThanOrEqual(after + 1000);
      expect((row.expires_at as Date).getTime() - issuedAt).toBe(SEVEN_DAYS_MS);
    }
  });
});
