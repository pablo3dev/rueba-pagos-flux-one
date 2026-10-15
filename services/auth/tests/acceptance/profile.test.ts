import { generateKeyPair, importPKCS8, SignJWT } from 'jose';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, testConfig } from '../support/build-test-app.js';
import { createTestPool, truncateAll } from '../support/db.js';

const ALICE = { email: 'alice@fluxone.test', password: 'demo_password_123' };
const ALICE_ID = '11111111-1111-4111-8111-111111111111';
const UNAUTHORIZED = {
  error: { code: 'UNAUTHORIZED', message: 'Token de acceso ausente o inválido.' },
};

describe('GET /auth/me', () => {
  let pool: pg.Pool;
  let app: FastifyInstance;
  const config = testConfig();

  function me(authorization?: string) {
    return app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: authorization === undefined ? {} : { authorization },
    });
  }

  async function accessToken(): Promise<string> {
    const response = await app.inject({ method: 'POST', url: '/auth/login', payload: ALICE });
    return response.json().accessToken;
  }

  // Llave de firma real del servicio (de `signing_keys`) para forjar tokens con firma válida.
  async function serviceSigningKey(): Promise<{ kid: string; key: CryptoKey }> {
    const { rows } = await pool.query(
      'SELECT kid, private_key_pkcs8 FROM auth_schema.signing_keys WHERE active',
    );
    return { kid: rows[0].kid, key: await importPKCS8(rows[0].private_key_pkcs8, 'EdDSA') };
  }

  async function forge(
    options: {
      issuer?: string;
      audience?: string;
      issuedAt?: number;
      expiresAt?: number;
      key?: CryptoKey;
    } = {},
  ): Promise<string> {
    const signing = await serviceSigningKey();
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ email: ALICE.email })
      .setProtectedHeader({ alg: 'EdDSA', kid: signing.kid })
      .setSubject(ALICE_ID)
      .setIssuer(options.issuer ?? config.jwtIssuer)
      .setAudience(options.audience ?? config.jwtAudience)
      .setIssuedAt(options.issuedAt ?? now)
      .setExpirationTime(options.expiresAt ?? now + 900)
      .sign(options.key ?? signing.key);
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

  it('[AC-AUT-17] con un token de acceso válido responde 200 con id y email, sin consultar la DB', async () => {
    const token = await accessToken();
    await pool.query('DELETE FROM auth_schema.refresh_tokens');
    await pool.query('DELETE FROM auth_schema.users'); // los datos salen de los claims

    const response = await me(`Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: ALICE_ID, email: ALICE.email });
  });

  it('[AC-AUT-17] el token forjado con la llave del servicio y claims correctos también es aceptado', async () => {
    const response = await me(`Bearer ${await forge()}`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: ALICE_ID, email: ALICE.email });
  });

  it('[AC-AUT-18] cabecera ausente o con esquema distinto de Bearer responde 401 UNAUTHORIZED', async () => {
    const token = await accessToken();
    const cases: Array<[string, string | undefined]> = [
      ['sin cabecera', undefined],
      ['cabecera vacía', ''],
      ['esquema Basic', `Basic ${token}`],
      ['token sin esquema', token],
      ['Bearer sin token', 'Bearer'],
      ['Bearer con token vacío', 'Bearer '],
    ];

    for (const [label, header] of cases) {
      const response = await me(header);
      expect(response.statusCode, label).toBe(401);
      expect(response.json(), label).toEqual(UNAUTHORIZED);
    }
  });

  it('[AC-AUT-18] token expirado, firma inválida, iss y aud incorrectos responden 401 UNAUTHORIZED', async () => {
    const now = Math.floor(Date.now() / 1000);
    const foreign = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
    const valid = await accessToken();
    const [header, payload, signature] = valid.split('.') as [string, string, string];
    const tampered = `${header}.${payload}.${signature.startsWith('A') ? 'B' : 'A'}${signature.slice(1)}`;
    const cases: Array<[string, string]> = [
      ['expirado', await forge({ issuedAt: now - 1800, expiresAt: now - 900 })],
      ['firma de otra llave', await forge({ key: foreign.privateKey })],
      ['firma alterada', tampered],
      ['iss incorrecto', await forge({ issuer: 'urn:otro:emisor' })],
      ['aud incorrecto', await forge({ audience: 'urn:otra:audiencia' })],
      ['no es un JWT', 'esto-no-es-un-jwt'],
    ];

    for (const [label, token] of cases) {
      const response = await me(`Bearer ${token}`);
      expect(response.statusCode, label).toBe(401);
      expect(response.json(), label).toEqual(UNAUTHORIZED);
    }
    // Control: el mismo mecanismo de forja con claims válidos sí pasa (la prueba mide, no supone).
    expect((await me(`Bearer ${await forge()}`)).statusCode).toBe(200);
  });

  it('[AC-AUT-18] un token sin firma (alg none) responde 401 UNAUTHORIZED', async () => {
    const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${b64({ alg: 'none' })}.${b64({
      sub: ALICE_ID,
      email: ALICE.email,
      iss: config.jwtIssuer,
      aud: config.jwtAudience,
      iat: now,
      exp: now + 900,
    })}.`;

    const response = await me(`Bearer ${unsigned}`);

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(UNAUTHORIZED);
  });
});
