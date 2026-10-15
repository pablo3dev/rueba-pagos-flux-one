import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestPool, truncateAll } from '../support/db.js';

const SHA256_HEX_A = 'a'.repeat(64);
const SHA256_HEX_B = 'b'.repeat(64);

describe('migración create-auth-tables', () => {
  let pool: pg.Pool;

  beforeAll(() => {
    pool = createTestPool();
  });

  beforeEach(async () => {
    await truncateAll(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  async function insertUser(email = `${randomUUID()}@example.com`): Promise<string> {
    const id = randomUUID();
    await pool.query(
      'INSERT INTO auth_schema.users (id, email, password_hash) VALUES ($1, $2, $3)',
      [id, email, 'hash'],
    );
    return id;
  }

  async function insertRefreshToken(
    userId: string,
    tokenHash: string,
    replacedById: string | null = null,
  ): Promise<string> {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO auth_schema.refresh_tokens
         (id, user_id, family_id, token_hash, expires_at, replaced_by_id)
       VALUES ($1, $2, $3, $4, now() + interval '1 day', $5)`,
      [id, userId, randomUUID(), tokenHash, replacedById],
    );
    return id;
  }

  async function insertSigningKey(active: boolean): Promise<void> {
    await pool.query(
      'INSERT INTO auth_schema.signing_keys (kid, public_jwk, private_key_pkcs8, active) VALUES ($1, $2, $3, $4)',
      [randomUUID(), { kty: 'OKP' }, 'pkcs8', active],
    );
  }

  it('crea las tablas users, refresh_tokens y signing_keys en auth_schema', async () => {
    const { rows } = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'auth_schema' AND table_name IN ('users', 'refresh_tokens', 'signing_keys')
       ORDER BY table_name`,
    );
    expect(rows.map((row) => row.table_name)).toEqual(['refresh_tokens', 'signing_keys', 'users']);
  });

  it('users_email_lower_chk rechaza correos con mayúsculas', async () => {
    await expect(insertUser('Mixed@Example.com')).rejects.toMatchObject({
      code: '23514',
      constraint: 'users_email_lower_chk',
    });
  });

  it('users.email es único', async () => {
    await insertUser('dup@example.com');
    await expect(insertUser('dup@example.com')).rejects.toMatchObject({
      code: '23505',
      constraint: 'users_email_key',
    });
  });

  it('signing_keys_one_active permite una sola llave activa y varias inactivas', async () => {
    await insertSigningKey(true);
    await expect(insertSigningKey(true)).rejects.toMatchObject({
      code: '23505',
      constraint: 'signing_keys_one_active',
    });
    await insertSigningKey(false);
    await insertSigningKey(false);
  });

  it('signing_keys_alg_chk rechaza algoritmos distintos de EdDSA', async () => {
    await expect(
      pool.query(
        `INSERT INTO auth_schema.signing_keys (kid, alg, public_jwk, private_key_pkcs8, active)
         VALUES ($1, 'RS256', '{}', 'pkcs8', false)`,
        [randomUUID()],
      ),
    ).rejects.toMatchObject({ code: '23514', constraint: 'signing_keys_alg_chk' });
  });

  it('refresh_tokens.user_id exige un usuario existente', async () => {
    await expect(insertRefreshToken(randomUUID(), SHA256_HEX_A)).rejects.toMatchObject({
      code: '23503',
    });
  });

  it('refresh_tokens.replaced_by_id exige un token existente', async () => {
    const userId = await insertUser();
    await expect(insertRefreshToken(userId, SHA256_HEX_A, randomUUID())).rejects.toMatchObject({
      code: '23503',
    });
  });

  it('refresh_tokens.token_hash es único', async () => {
    const userId = await insertUser();
    await insertRefreshToken(userId, SHA256_HEX_A);
    await expect(insertRefreshToken(userId, SHA256_HEX_A)).rejects.toMatchObject({
      code: '23505',
      constraint: 'refresh_tokens_token_hash_key',
    });
    await insertRefreshToken(userId, SHA256_HEX_B);
  });

  it('eliminar un usuario elimina sus refresh tokens (ON DELETE CASCADE)', async () => {
    const userId = await insertUser();
    await insertRefreshToken(userId, SHA256_HEX_A);
    await pool.query('DELETE FROM auth_schema.users WHERE id = $1', [userId]);
    const { rows } = await pool.query('SELECT 1 FROM auth_schema.refresh_tokens');
    expect(rows).toHaveLength(0);
  });
});
