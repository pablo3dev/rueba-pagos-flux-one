import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PgRefreshTokenRepository } from '../../src/adapters/outbound/postgres/pg-refresh-token-repository.js';
import type { RotationOutcome } from '../../src/application/ports/refresh-token-repository.js';
import type { RefreshToken } from '../../src/domain/refresh-token.js';
import { createTestPool, truncateAll } from '../support/db.js';

const NOW = new Date('2026-03-01T12:00:00.000Z');
const IN_7_DAYS = new Date(NOW.getTime() + 604800 * 1000);
const YESTERDAY = new Date(NOW.getTime() - 86400 * 1000);

function hashOf(label: string): string {
  return label.padEnd(64, '0').slice(0, 64);
}

interface TokenRow {
  id: string;
  user_id: string;
  family_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  replaced_by_id: string | null;
  created_at: Date;
}

describe('PgRefreshTokenRepository', () => {
  let pool: pg.Pool;
  let repository: PgRefreshTokenRepository;
  let userId: string;

  beforeAll(() => {
    pool = createTestPool();
    repository = new PgRefreshTokenRepository(pool);
  });

  beforeEach(async () => {
    await truncateAll(pool);
    userId = randomUUID();
    await pool.query(
      'INSERT INTO auth_schema.users (id, email, password_hash) VALUES ($1, $2, $3)',
      [userId, `${userId}@example.com`, 'hash'],
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  function buildToken(overrides: Partial<RefreshToken> = {}): RefreshToken {
    return {
      id: randomUUID(),
      userId,
      familyId: randomUUID(),
      tokenHash: hashOf(randomUUID().replaceAll('-', '')),
      expiresAt: IN_7_DAYS,
      revokedAt: null,
      replacedById: null,
      createdAt: NOW,
      ...overrides,
    };
  }

  async function rowByHash(tokenHash: string): Promise<TokenRow> {
    const { rows } = await pool.query<TokenRow>(
      `SELECT id, user_id, family_id, token_hash, expires_at, revoked_at, replaced_by_id, created_at
       FROM auth_schema.refresh_tokens WHERE token_hash = $1`,
      [tokenHash],
    );
    const row = rows[0];
    if (!row) throw new Error(`sin fila para ${tokenHash}`);
    return row;
  }

  function nextInput(label: string): { id: string; tokenHash: string; expiresAt: Date } {
    return { id: randomUUID(), tokenHash: hashOf(label), expiresAt: IN_7_DAYS };
  }

  it('[AC-AUT-14] insert guarda solo la huella SHA-256 y la vigencia indicada', async () => {
    const token = buildToken({ tokenHash: hashOf('abc') });

    await repository.insert(token);

    expect(await rowByHash(hashOf('abc'))).toEqual({
      id: token.id,
      user_id: userId,
      family_id: token.familyId,
      token_hash: hashOf('abc'),
      expires_at: IN_7_DAYS,
      revoked_at: null,
      replaced_by_id: null,
      created_at: NOW,
    });
  });

  it('[AC-AUT-11] rotate de un token vigente devuelve ROTATED, revoca el actual y crea el sucesor en la misma familia', async () => {
    const current = buildToken({ tokenHash: hashOf('current') });
    await repository.insert(current);
    const next = nextInput('successor');

    const outcome = await repository.rotate({
      currentTokenHash: current.tokenHash,
      now: NOW,
      next,
    });

    expect(outcome).toEqual({ status: 'ROTATED', userId, familyId: current.familyId });
    const oldRow = await rowByHash(current.tokenHash);
    expect(oldRow.revoked_at).toEqual(NOW);
    expect(oldRow.replaced_by_id).toBe(next.id);
    const newRow = await rowByHash(next.tokenHash);
    expect(newRow).toMatchObject({
      id: next.id,
      user_id: userId,
      family_id: current.familyId,
      expires_at: IN_7_DAYS,
      revoked_at: null,
      replaced_by_id: null,
      created_at: NOW,
    });
  });

  it('[AC-AUT-12] rotate de un token ya rotado devuelve REUSED y revoca toda la familia', async () => {
    const current = buildToken({ tokenHash: hashOf('current') });
    await repository.insert(current);
    const next = nextInput('successor');
    await repository.rotate({ currentTokenHash: current.tokenHash, now: NOW, next });
    const other = buildToken({ tokenHash: hashOf('other-family') });
    await repository.insert(other);
    const later = new Date(NOW.getTime() + 60000);

    const outcome = await repository.rotate({
      currentTokenHash: current.tokenHash,
      now: later,
      next: nextInput('unused'),
    });

    expect(outcome).toEqual({ status: 'REUSED', userId, familyId: current.familyId });
    expect((await rowByHash(next.tokenHash)).revoked_at).toEqual(later);
    expect((await rowByHash(current.tokenHash)).revoked_at).toEqual(NOW);
    expect((await rowByHash(other.tokenHash)).revoked_at).toBeNull();
    const { rows } = await pool.query('SELECT 1 FROM auth_schema.refresh_tokens');
    expect(rows).toHaveLength(3);
  });

  it('[AC-AUT-12] rotate de un token revocado y expirado devuelve REUSED', async () => {
    const token = buildToken({
      tokenHash: hashOf('revoked'),
      expiresAt: YESTERDAY,
      revokedAt: YESTERDAY,
    });
    await repository.insert(token);

    const outcome = await repository.rotate({
      currentTokenHash: token.tokenHash,
      now: NOW,
      next: nextInput('unused'),
    });

    expect(outcome).toEqual({ status: 'REUSED', userId, familyId: token.familyId });
  });

  it('[AC-AUT-13] rotate de un token expirado devuelve EXPIRED sin cambiar nada', async () => {
    const token = buildToken({ tokenHash: hashOf('expired'), expiresAt: YESTERDAY });
    await repository.insert(token);
    const before = await rowByHash(token.tokenHash);

    const outcome = await repository.rotate({
      currentTokenHash: token.tokenHash,
      now: NOW,
      next: nextInput('unused'),
    });

    expect(outcome).toEqual({ status: 'EXPIRED' });
    expect(await rowByHash(token.tokenHash)).toEqual(before);
    const { rows } = await pool.query('SELECT 1 FROM auth_schema.refresh_tokens');
    expect(rows).toHaveLength(1);
  });

  it('[AC-AUT-13] rotate de un token desconocido devuelve NOT_FOUND', async () => {
    const outcome = await repository.rotate({
      currentTokenHash: hashOf('unknown'),
      now: NOW,
      next: nextInput('unused'),
    });

    expect(outcome).toEqual({ status: 'NOT_FOUND' });
  });

  it('[AC-AUT-12] rotate hace ROLLBACK y relanza ante un error inesperado, sin dejar cambios', async () => {
    const current = buildToken({ tokenHash: hashOf('current') });
    const taken = buildToken({ tokenHash: hashOf('taken') });
    await repository.insert(current);
    await repository.insert(taken);

    await expect(
      repository.rotate({
        currentTokenHash: current.tokenHash,
        now: NOW,
        next: { id: randomUUID(), tokenHash: taken.tokenHash, expiresAt: IN_7_DAYS },
      }),
    ).rejects.toMatchObject({ code: '23505', constraint: 'refresh_tokens_token_hash_key' });

    expect((await rowByHash(current.tokenHash)).revoked_at).toBeNull();
    const { rows } = await pool.query('SELECT 1 FROM auth_schema.refresh_tokens');
    expect(rows).toHaveLength(2);
  });

  it('[AC-AUT-11] rotate concurrente sobre el mismo token da un ROTATED y un REUSED y revoca toda la familia', async () => {
    const current = buildToken({ tokenHash: hashOf('current') });
    await repository.insert(current);
    const nextA = nextInput('next-a');
    const nextB = nextInput('next-b');

    const outcomes: RotationOutcome[] = await Promise.all([
      repository.rotate({ currentTokenHash: current.tokenHash, now: NOW, next: nextA }),
      repository.rotate({ currentTokenHash: current.tokenHash, now: NOW, next: nextB }),
    ]);

    expect(outcomes.filter((o) => o.status === 'ROTATED')).toHaveLength(1);
    expect(outcomes.filter((o) => o.status === 'REUSED')).toHaveLength(1);
    const { rows } = await pool.query<{ total: string; active: string }>(
      `SELECT count(*) AS total, count(*) FILTER (WHERE revoked_at IS NULL) AS active
       FROM auth_schema.refresh_tokens WHERE family_id = $1`,
      [current.familyId],
    );
    expect(rows[0]).toEqual({ total: '2', active: '0' });
  });

  it('[AC-AUT-15] revokeFamilyByTokenHash revoca solo los tokens activos de la familia del token', async () => {
    const familyId = randomUUID();
    const first = buildToken({ familyId, tokenHash: hashOf('first') });
    const second = buildToken({ familyId, tokenHash: hashOf('second') });
    const alreadyRevoked = buildToken({ familyId, tokenHash: hashOf('old'), revokedAt: YESTERDAY });
    const other = buildToken({ tokenHash: hashOf('other-family') });
    for (const token of [first, second, alreadyRevoked, other]) await repository.insert(token);

    await repository.revokeFamilyByTokenHash(first.tokenHash, NOW);

    expect((await rowByHash(first.tokenHash)).revoked_at).toEqual(NOW);
    expect((await rowByHash(second.tokenHash)).revoked_at).toEqual(NOW);
    expect((await rowByHash(alreadyRevoked.tokenHash)).revoked_at).toEqual(YESTERDAY);
    expect((await rowByHash(other.tokenHash)).revoked_at).toBeNull();
  });

  it('[AC-AUT-16] revokeFamilyByTokenHash con un hash desconocido no falla ni modifica filas', async () => {
    const token = buildToken({ tokenHash: hashOf('known') });
    await repository.insert(token);

    await expect(
      repository.revokeFamilyByTokenHash(hashOf('unknown'), NOW),
    ).resolves.toBeUndefined();

    expect((await rowByHash(token.tokenHash)).revoked_at).toBeNull();
  });
});
