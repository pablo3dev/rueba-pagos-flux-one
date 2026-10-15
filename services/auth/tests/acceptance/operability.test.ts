import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from '../support/build-test-app.js';
import { createTestPool, truncateAll } from '../support/db.js';

const ALICE = { email: 'alice@fluxone.test', password: 'demo_password_123' };
const UNKNOWN_EMAIL = 'Nadie@Fluxone.test';

interface LogEntry {
  event?: string;
  level?: number;
  emailHash?: string;
  userId?: string;
  familyId?: string;
  [key: string]: unknown;
}

// `name=value` de la cabecera Set-Cookie, tal como el navegador lo reenviaría.
function cookiePair(setCookie: string | string[] | undefined): string {
  const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return (header as string).split(';')[0] as string;
}

describe('Operación: health, errores y logs', () => {
  let pool: pg.Pool;
  let app: FastifyInstance | undefined;
  let lines: string[];

  const logStream = { write: (message: string): void => void lines.push(message) };

  function entries(): LogEntry[] {
    return lines.map((line) => JSON.parse(line) as LogEntry);
  }

  beforeAll(() => {
    pool = createTestPool();
  });

  beforeEach(async () => {
    lines = [];
    await truncateAll(pool);
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  afterAll(async () => {
    await pool.end();
  });

  it('[AC-AUT-22] /health/ready devuelve 503 con el pool cerrado y /health/live sigue en 200', async () => {
    const ownPool = createTestPool();
    app = await buildTestApp(ownPool);

    const ready = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toEqual({ status: 'ok' });

    await ownPool.end();

    const unavailable = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(unavailable.statusCode).toBe(503);
    expect(unavailable.json()).toEqual({ status: 'unavailable' });

    const live = await app.inject({ method: 'GET', url: '/health/live' });
    expect(live.statusCode).toBe(200);
    expect(live.json()).toEqual({ status: 'ok' });
  });

  it('[AC-AUT-23] una ruta inexistente responde 404 NOT_FOUND con el formato uniforme', async () => {
    app = await buildTestApp(pool);

    const response = await app.inject({ method: 'GET', url: '/no-existe' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Recurso no encontrado.' },
    });
  });

  it('[AC-AUT-23] un error inesperado responde 500 INTERNAL_ERROR con cuerpo genérico y queda en el log', async () => {
    const ownPool = createTestPool();
    app = await buildTestApp(ownPool, { config: { logLevel: 'info' }, logStream });
    // Con el pool cerrado, el acceso a la DB del login falla con un error no controlado.
    await ownPool.end();

    const response = await app.inject({ method: 'POST', url: '/auth/login', payload: ALICE });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor.' },
    });
    expect(response.body).not.toMatch(/pool|postgres|stack|ECONN/i);
    const logged = entries().find((entry) => entry.level === 50);
    expect(logged).toBeDefined();
    expect(logged).toHaveProperty('err');
  });

  it('[AC-AUT-24] los logs registran los eventos de auth sin contraseña, token, cookie ni email en el login fallido', async () => {
    app = await buildTestApp(pool, { config: { logLevel: 'info' }, logStream });

    const login = await app.inject({ method: 'POST', url: '/auth/login', payload: ALICE });
    expect(login.statusCode).toBe(200);
    const accessToken = login.json<{ accessToken: string }>().accessToken;
    const firstCookie = cookiePair(login.headers['set-cookie']);
    const cookieValue = decodeURIComponent(firstCookie.slice('refresh_token='.length));

    const failed = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: UNKNOWN_EMAIL, password: 'otra_clave_incorrecta_1' },
    });
    expect(failed.statusCode).toBe(401);

    const rotated = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { cookie: firstCookie },
    });
    expect(rotated.statusCode).toBe(200);
    const reused = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { cookie: firstCookie },
    });
    expect(reused.statusCode).toBe(401);

    const all = entries();
    const succeeded = all.find((entry) => entry.event === 'auth.login_succeeded');
    expect(succeeded?.userId).toBe('11111111-1111-4111-8111-111111111111');

    const failedEvent = all.find((entry) => entry.event === 'auth.login_failed');
    expect(failedEvent?.emailHash).toBe(
      createHash('sha256').update(UNKNOWN_EMAIL.trim().toLowerCase()).digest('hex'),
    );
    const failedLine = JSON.stringify(failedEvent).toLowerCase();
    expect(failedLine).not.toContain('nadie@fluxone.test');
    expect(failedLine).not.toContain('otra_clave_incorrecta_1');

    const reuseEvent = all.find((entry) => entry.event === 'auth.refresh_reuse_detected');
    expect(reuseEvent?.userId).toBe('11111111-1111-4111-8111-111111111111');
    expect(reuseEvent?.familyId).toEqual(expect.any(String));

    const captured = lines.join('\n');
    expect(captured).not.toContain(ALICE.password);
    expect(captured).not.toContain('otra_clave_incorrecta_1');
    expect(captured).not.toContain(accessToken);
    expect(captured).not.toContain(cookieValue);
    expect(captured).not.toContain(cookieValue.slice(0, cookieValue.lastIndexOf('.')));
  });
});
