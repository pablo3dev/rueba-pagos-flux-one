import { createLocalJWKSet, jwtVerify } from 'jose';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, testConfig } from '../support/build-test-app.js';
import { createTestPool, truncateAll } from '../support/db.js';

const ALICE = { email: 'alice@fluxone.test', password: 'demo_password_123' };
const ALICE_ID = '11111111-1111-4111-8111-111111111111';
const INVALID_CREDENTIALS = {
  error: { code: 'INVALID_CREDENTIALS', message: 'Correo o contraseña incorrectos.' },
};

describe('POST /auth/login', () => {
  let pool: pg.Pool;
  let app: FastifyInstance;

  function login(payload: unknown, ip?: string) {
    return app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: payload as object,
      headers: ip === undefined ? {} : { 'x-real-ip': ip },
    });
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

  it('[AC-AUT-06] un login válido responde 200 con la sesión y la cookie refresh_token con sus atributos', async () => {
    const response = await login(ALICE);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      accessToken: expect.any(String),
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { id: ALICE_ID, email: ALICE.email },
    });
    const setCookie = response.headers['set-cookie'];
    expect(typeof setCookie).toBe('string');
    const header = setCookie as string;
    expect(header).toMatch(/^refresh_token=[^;]+\./); // valor firmado: <token>.<firma>
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Strict');
    expect(header).toContain('Path=/api/auth');
    expect(header).toContain('Max-Age=604800');
    expect(header).not.toContain('Secure'); // COOKIE_SECURE=false en pruebas
    // El refresh token solo viaja en la cookie, nunca en el cuerpo.
    const cookieValue = decodeURIComponent((header.match(/^refresh_token=([^;]+)/) as string[])[1]);
    expect(response.body).not.toContain(cookieValue.split('.')[0]);
    expect(response.json()).not.toHaveProperty('refreshToken');
    const { rows } = await pool.query(
      'SELECT count(*)::int AS total FROM auth_schema.refresh_tokens WHERE user_id = $1',
      [ALICE_ID],
    );
    expect(rows[0].total).toBe(1);
  });

  it('[AC-AUT-06] con COOKIE_SECURE=true la cookie incluye Secure', async () => {
    await app.close();
    app = await buildTestApp(pool, { config: { cookieSecure: true } });

    const response = await login(ALICE);

    expect(response.statusCode).toBe(200);
    expect(response.headers['set-cookie']).toContain('Secure');
  });

  it('[AC-AUT-07] email inexistente y contraseña errónea dan 401 con el mismo mensaje y sin cookie', async () => {
    const unknownEmail = await login({ email: 'nadie@fluxone.test', password: ALICE.password });
    const wrongPassword = await login({ email: ALICE.email, password: 'contraseña-incorrecta' });

    for (const response of [unknownEmail, wrongPassword]) {
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual(INVALID_CREDENTIALS);
      expect(response.headers['set-cookie']).toBeUndefined();
    }
    expect(unknownEmail.body).toBe(wrongPassword.body);
    const { rows } = await pool.query(
      'SELECT count(*)::int AS total FROM auth_schema.refresh_tokens',
    );
    expect(rows[0].total).toBe(0);
  });

  it('[AC-AUT-07] un email malformado también da 401 INVALID_CREDENTIALS (no valida forma)', async () => {
    const response = await login({ email: 'no-es-un-email', password: 'x' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(INVALID_CREDENTIALS);
  });

  it('[AC-AUT-08] el 6.º login por IP recibe 429 RATE_LIMITED e IP distintas tienen límites independientes', async () => {
    const ipA = '198.51.100.10';
    const ipB = '198.51.100.11';
    const statuses: number[] = [];
    for (let i = 1; i <= 5; i += 1) {
      statuses.push((await login(ALICE, ipA)).statusCode);
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200]);

    const sixth = await login(ALICE, ipA);

    expect(sixth.statusCode).toBe(429);
    expect(sixth.json()).toEqual({
      error: {
        code: 'RATE_LIMITED',
        message: 'Demasiados intentos. Intenta de nuevo en un minuto.',
      },
    });
    expect(sixth.headers['set-cookie']).toBeUndefined();

    const otherIp = await login(ALICE, ipB);
    expect(otherIp.statusCode).toBe(200);
    expect((await login(ALICE, ipA)).statusCode).toBe(429);
  });

  it('[AC-AUT-09] el access token EdDSA de 15 min verifica con el JWKS publicado', async () => {
    const config = testConfig();
    const response = await login(ALICE);
    const jwksResponse = await app.inject({ method: 'GET', url: '/.well-known/jwks.json' });
    const jwks = jwksResponse.json<{ keys: Array<{ kid: string }> }>();

    const { payload, protectedHeader } = await jwtVerify(
      response.json().accessToken,
      createLocalJWKSet({ keys: jwks.keys as never }),
      { issuer: config.jwtIssuer, audience: config.jwtAudience, algorithms: ['EdDSA'] },
    );

    expect(protectedHeader.alg).toBe('EdDSA');
    expect(protectedHeader.kid).toBe(jwks.keys[0]?.kid);
    expect(payload.iss).toBe('urn:fluxone:auth');
    expect(payload.aud).toBe('urn:fluxone:api');
    expect(payload.sub).toBe(ALICE_ID);
    expect(payload.email).toBe(ALICE.email);
    expect((payload.exp as number) - (payload.iat as number)).toBe(900);
  });

  it('[AC-AUT-10] cuerpos malformados o con campos adicionales responden 400 VALIDATION_ERROR', async () => {
    const invalid: Array<[string, unknown]> = [
      ['falta la contraseña', { email: ALICE.email }],
      ['falta el email', { password: ALICE.password }],
      ['email que no es texto', { email: 123, password: ALICE.password }],
      ['contraseña que no es texto', { email: ALICE.email, password: { $ne: '' } }],
      ['campo adicional', { ...ALICE, remember: true }],
      ['email de más de 1024 caracteres', { email: 'a'.repeat(1025), password: ALICE.password }],
    ];

    // Una IP distinta por solicitud: todas cuentan para el límite de 5/min y no es lo que se prueba aquí.
    for (const [index, [label, payload]] of invalid.entries()) {
      const response = await login(payload, `192.0.2.${index + 1}`);
      expect(response.statusCode, label).toBe(400);
      expect(response.json().error.code, label).toBe('VALIDATION_ERROR');
      expect(response.headers['set-cookie'], label).toBeUndefined();
    }

    const noBody = await app.inject({ method: 'POST', url: '/auth/login' });
    expect(noBody.statusCode).toBe(400);
    expect(noBody.json().error.code).toBe('VALIDATION_ERROR');
  });
});
