import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PgUserRepository } from '../../src/adapters/outbound/postgres/pg-user-repository.js';
import { EmailAlreadyRegisteredError } from '../../src/domain/errors.js';
import type { User } from '../../src/domain/user.js';
import { createTestPool, truncateAll } from '../support/db.js';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: randomUUID(),
    email: `${randomUUID()}@example.com`,
    passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$hash',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('PgUserRepository', () => {
  let pool: pg.Pool;
  let repository: PgUserRepository;

  beforeAll(() => {
    pool = createTestPool();
    repository = new PgUserRepository(pool);
  });

  beforeEach(async () => {
    await truncateAll(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('[AC-AUT-01] insert persiste el usuario y findByEmail y findById lo devuelven completo', async () => {
    const user = buildUser({ email: 'alice@example.com' });

    await repository.insert(user);

    expect(await repository.findByEmail('alice@example.com')).toEqual(user);
    expect(await repository.findById(user.id)).toEqual(user);
  });

  it('[AC-AUT-01] findByEmail y findById devuelven null si no hay fila', async () => {
    expect(await repository.findByEmail('nadie@example.com')).toBeNull();
    expect(await repository.findById(randomUUID())).toBeNull();
  });

  it('[AC-AUT-03] insert de un email duplicado lanza EmailAlreadyRegisteredError', async () => {
    await repository.insert(buildUser({ email: 'dup@example.com' }));

    await expect(repository.insert(buildUser({ email: 'dup@example.com' }))).rejects.toBeInstanceOf(
      EmailAlreadyRegisteredError,
    );
  });

  it('[AC-AUT-03] insert concurrente del mismo email deja un solo alta y un EmailAlreadyRegisteredError', async () => {
    const results = await Promise.allSettled([
      repository.insert(buildUser({ email: 'race@example.com' })),
      repository.insert(buildUser({ email: 'race@example.com' })),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(EmailAlreadyRegisteredError);
    const { rows } = await pool.query('SELECT 1 FROM auth_schema.users');
    expect(rows).toHaveLength(1);
  });

  it('[AC-AUT-03] insert con un id duplicado propaga el error de DB sin traducirlo', async () => {
    const user = buildUser();
    await repository.insert(user);

    await expect(repository.insert(buildUser({ id: user.id }))).rejects.toMatchObject({
      code: '23505',
      constraint: 'users_pkey',
    });
  });

  it('[AC-AUT-21] insertIfAbsent crea el usuario y no duplica ni modifica al existente', async () => {
    const user = buildUser({ email: 'seed@example.com' });

    await repository.insertIfAbsent(user);
    await repository.insertIfAbsent({ ...user, passwordHash: 'otro-hash' });
    await repository.insertIfAbsent(buildUser({ id: user.id, email: 'otro@example.com' }));

    const { rows } = await pool.query('SELECT 1 FROM auth_schema.users');
    expect(rows).toHaveLength(1);
    expect(await repository.findById(user.id)).toEqual(user);
  });
});
