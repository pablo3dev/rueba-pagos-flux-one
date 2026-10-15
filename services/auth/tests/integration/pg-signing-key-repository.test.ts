import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PgSigningKeyRepository } from '../../src/adapters/outbound/postgres/pg-signing-key-repository.js';
import type { SigningKey } from '../../src/domain/signing-key.js';
import { createTestPool, truncateAll } from '../support/db.js';

function buildKey(overrides: Partial<SigningKey> = {}): SigningKey {
  const kid = overrides.kid ?? randomUUID();
  return {
    kid,
    alg: 'EdDSA',
    publicJwk: { kty: 'OKP', crv: 'Ed25519', x: 'public-x', kid, alg: 'EdDSA', use: 'sig' },
    privateKeyPkcs8: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
    active: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('PgSigningKeyRepository', () => {
  let pool: pg.Pool;
  let repository: PgSigningKeyRepository;

  beforeAll(() => {
    pool = createTestPool();
    repository = new PgSigningKeyRepository(pool);
  });

  beforeEach(async () => {
    await truncateAll(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('[AC-AUT-20] findActive devuelve null sin llaves y la llave completa tras insertarla', async () => {
    expect(await repository.findActive()).toBeNull();

    const key = buildKey();
    await repository.insertIfNoActive(key);

    expect(await repository.findActive()).toEqual(key);
  });

  it('[AC-AUT-20] insertIfNoActive no reemplaza la llave activa existente', async () => {
    const first = buildKey();
    await repository.insertIfNoActive(first);
    await repository.insertIfNoActive(buildKey());

    expect(await repository.findActive()).toEqual(first);
    expect(await repository.listAll()).toHaveLength(1);
  });

  it('[AC-AUT-20] insertIfNoActive concurrente deja una sola llave activa', async () => {
    await Promise.all(Array.from({ length: 5 }, () => repository.insertIfNoActive(buildKey())));

    const { rows } = await pool.query<{ total: string; active: string }>(
      `SELECT count(*) AS total, count(*) FILTER (WHERE active) AS active
       FROM auth_schema.signing_keys`,
    );
    expect(rows[0]).toEqual({ total: '1', active: '1' });
    expect(await repository.findActive()).not.toBeNull();
  });

  it('[AC-AUT-19] listAll devuelve todas las llaves ordenadas por created_at y kid', async () => {
    const oldest = buildKey({
      kid: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      active: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const tieA = buildKey({
      kid: '00000000-0000-4000-8000-00000000000a',
      active: false,
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
    });
    const tieB = buildKey({
      kid: '00000000-0000-4000-8000-00000000000b',
      active: true,
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
    });
    await repository.insertIfNoActive(tieB);
    await repository.insertIfNoActive(tieA);
    await repository.insertIfNoActive(oldest);

    expect(await repository.listAll()).toEqual([oldest, tieA, tieB]);
  });
});
