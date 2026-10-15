import { createLocalJWKSet, jwtVerify } from 'jose';
import type pg from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { JoseTokenIssuer } from '../../src/adapters/outbound/crypto/jose-token-issuer.js';
import { SystemClock } from '../../src/adapters/outbound/crypto/system-clock.js';
import { PgSigningKeyRepository } from '../../src/adapters/outbound/postgres/pg-signing-key-repository.js';
import { buildTestApp, testConfig } from '../support/build-test-app.js';
import { createTestPool, truncateAll } from '../support/db.js';

interface Jwk {
  kty: string;
  crv: string;
  x: string;
  kid: string;
  alg: string;
  use: string;
  d?: string;
}

describe('JWKS', () => {
  let pool: pg.Pool;
  const apps: FastifyInstance[] = [];

  async function startApp(): Promise<FastifyInstance> {
    const app = await buildTestApp(pool);
    apps.push(app);
    return app;
  }

  async function getJwks(app: FastifyInstance): Promise<{ keys: Jwk[] }> {
    const response = await app.inject({ method: 'GET', url: '/.well-known/jwks.json' });
    expect(response.statusCode).toBe(200);
    return response.json<{ keys: Jwk[] }>();
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

  it('[AC-AUT-19] publica solo la llave pública Ed25519 vigente, sin material privado', async () => {
    const app = await startApp();

    const response = await app.inject({ method: 'GET', url: '/.well-known/jwks.json' });

    expect(response.statusCode).toBe(200);
    const { keys } = response.json<{ keys: Jwk[] }>();
    expect(keys).toHaveLength(1);
    const [key] = keys;
    expect(key).toMatchObject({ kty: 'OKP', crv: 'Ed25519', alg: 'EdDSA', use: 'sig' });
    expect(key?.kid).toMatch(/^[0-9a-f-]{36}$/);
    expect(key?.x).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Object.keys(key ?? {}).sort()).toEqual(['alg', 'crv', 'kid', 'kty', 'use', 'x']);
    expect(response.body).not.toContain('PRIVATE KEY');
  });

  it('[AC-AUT-20] reutiliza el mismo par de llaves tras reiniciar y verifica tokens previos', async () => {
    const first = await startApp();
    const firstKeys = (await getJwks(first)).keys;

    // Token emitido antes del segundo arranque, con la llave persistida por el primero.
    const storedKeys = await new PgSigningKeyRepository(pool).listAll();
    const config = testConfig();
    const issuer = new JoseTokenIssuer({
      keys: storedKeys,
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
      clock: new SystemClock(),
    });
    const { accessToken } = await issuer.issueAccessToken({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'alice@fluxone.test',
    });

    // "Reinicio": se cierra la primera app y se compone otra sobre la misma DB.
    await first.close();
    const second = await startApp();
    const secondKeys = (await getJwks(second)).keys;

    expect(secondKeys).toHaveLength(1);
    expect(secondKeys[0]?.kid).toBe(firstKeys[0]?.kid);
    expect(secondKeys).toEqual(firstKeys);
    const { rows } = await pool.query(
      'SELECT count(*)::int AS total FROM auth_schema.signing_keys',
    );
    expect(rows[0].total).toBe(1);

    const { payload, protectedHeader } = await jwtVerify(
      accessToken,
      createLocalJWKSet({ keys: secondKeys }),
      { issuer: config.jwtIssuer, audience: config.jwtAudience, algorithms: ['EdDSA'] },
    );
    expect(protectedHeader.kid).toBe(firstKeys[0]?.kid);
    expect(payload.sub).toBe('11111111-1111-4111-8111-111111111111');
  });
});
