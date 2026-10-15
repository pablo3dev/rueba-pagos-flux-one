import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from '../support/build-test-app.js';
import { createTestPool, truncateAll } from '../support/db.js';

const ALICE = { email: 'alice@fluxone.test', password: 'demo_password_123' };

function cookiePair(setCookie: string | string[] | undefined): string {
  const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return (header as string).split(';')[0] as string;
}

describe('POST /auth/logout', () => {
  let pool: pg.Pool;
  let app: FastifyInstance;

  function logout(cookie?: string) {
    return app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: cookie === undefined ? {} : { cookie },
    });
  }

  async function loginCookie(): Promise<string> {
    const response = await app.inject({ method: 'POST', url: '/auth/login', payload: ALICE });
    expect(response.statusCode).toBe(200);
    return cookiePair(response.headers['set-cookie']);
  }

  async function activeTokens(): Promise<number> {
    const { rows } = await pool.query(
      'SELECT count(*)::int AS total FROM auth_schema.refresh_tokens WHERE revoked_at IS NULL',
    );
    return rows[0].total;
  }

  function expectCookieCleared(response: { headers: Record<string, unknown> }): void {
    const setCookie = response.headers['set-cookie'] as string;
    expect(setCookie).toMatch(/^refresh_token=;/);
    expect(setCookie).toContain('Path=/api/auth');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');
    expect(setCookie).toMatch(/Expires=Thu, 01 Jan 1970/);
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

  it('[AC-AUT-15] con cookie válida revoca la sesión, limpia la cookie y responde 204 sin cuerpo', async () => {
    const cookie = await loginCookie();
    expect(await activeTokens()).toBe(1);

    const response = await logout(cookie);

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expectCookieCleared(response);
    expect(await activeTokens()).toBe(0);

    // La sesión revocada ya no se puede renovar.
    const refresh = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { cookie },
    });
    expect(refresh.statusCode).toBe(401);
  });

  it('[AC-AUT-15] revoca toda la familia de la sesión, incluidos los tokens rotados', async () => {
    const first = await loginCookie();
    const rotated = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { cookie: first },
    });
    const current = cookiePair(rotated.headers['set-cookie']);
    expect(await activeTokens()).toBe(1);

    const response = await logout(current);

    expect(response.statusCode).toBe(204);
    expect(await activeTokens()).toBe(0);
  });

  it('[AC-AUT-15] solo revoca la sesión indicada: otra sesión del mismo usuario sigue activa', async () => {
    const cookieA = await loginCookie();
    await loginCookie();
    expect(await activeTokens()).toBe(2);

    await logout(cookieA);

    expect(await activeTokens()).toBe(1);
  });

  it('[AC-AUT-16] sin cookie responde 204 y limpia la cookie', async () => {
    await loginCookie();

    const response = await logout();

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expectCookieCleared(response);
    expect(await activeTokens()).toBe(1); // no toca ninguna sesión
  });

  it('[AC-AUT-16] con cookie alterada, sin firma o desconocida responde 204 y limpia la cookie', async () => {
    const valid = await loginCookie();
    const value = decodeURIComponent(valid.slice('refresh_token='.length));
    const token = value.slice(0, value.lastIndexOf('.'));
    const cookies = [
      `refresh_token=${encodeURIComponent(`${token}.${'A'.repeat(43)}`)}`,
      `refresh_token=${encodeURIComponent(token)}`,
      `refresh_token=${encodeURIComponent(app.signCookie('valor-desconocido'))}`,
    ];

    for (const cookie of cookies) {
      const response = await logout(cookie);
      expect(response.statusCode, cookie).toBe(204);
      expect(response.body, cookie).toBe('');
      expectCookieCleared(response);
    }
    expect(await activeTokens()).toBe(1); // la sesión real no se vio afectada
  });

  it('[AC-AUT-16] es idempotente: repetir el cierre con la misma cookie sigue dando 204', async () => {
    const cookie = await loginCookie();

    const statuses = [(await logout(cookie)).statusCode, (await logout(cookie)).statusCode];

    expect(statuses).toEqual([204, 204]);
    expect(await activeTokens()).toBe(0);
  });
});
