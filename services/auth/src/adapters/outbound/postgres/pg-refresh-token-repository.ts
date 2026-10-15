// adapter: out — PostgreSQL (pg) para RefreshTokenRepository; rotación atómica con FOR UPDATE
import type { Pool } from 'pg';
import type {
  RefreshTokenRepository,
  RotationOutcome,
} from '../../../application/ports/refresh-token-repository.js';
import { decideRotation, type RefreshToken } from '../../../domain/refresh-token.js';

interface CurrentTokenRow {
  id: string;
  user_id: string;
  family_id: string;
  expires_at: Date;
  revoked_at: Date | null;
}

export class PgRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly pool: Pool) {}

  async insert(token: RefreshToken): Promise<void> {
    await this.pool.query(
      `INSERT INTO auth_schema.refresh_tokens
         (id, user_id, family_id, token_hash, expires_at, revoked_at, replaced_by_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        token.id,
        token.userId,
        token.familyId,
        token.tokenHash,
        token.expiresAt,
        token.revokedAt,
        token.replacedById,
        token.createdAt,
      ],
    );
  }

  // Un solo uso garantizado: SELECT ... FOR UPDATE serializa las solicitudes concurrentes sobre el
  // mismo token; la segunda ve el token ya revocado y obtiene REUSED (revoca la familia).
  async rotate(input: {
    currentTokenHash: string;
    now: Date;
    next: { id: string; tokenHash: string; expiresAt: Date };
  }): Promise<RotationOutcome> {
    const { currentTokenHash, now, next } = input;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query<CurrentTokenRow>(
        `SELECT id, user_id, family_id, expires_at, revoked_at
         FROM auth_schema.refresh_tokens
         WHERE token_hash = $1
         FOR UPDATE`,
        [currentTokenHash],
      );
      const current = rows[0];
      if (!current) {
        await client.query('COMMIT');
        return { status: 'NOT_FOUND' };
      }

      const decision = decideRotation(
        { revokedAt: current.revoked_at, expiresAt: current.expires_at },
        now,
      );

      if (decision === 'REUSED') {
        await client.query(
          `UPDATE auth_schema.refresh_tokens
           SET revoked_at = $1
           WHERE family_id = $2 AND revoked_at IS NULL`,
          [now, current.family_id],
        );
        await client.query('COMMIT');
        return { status: 'REUSED', userId: current.user_id, familyId: current.family_id };
      }

      if (decision === 'EXPIRED') {
        await client.query('COMMIT');
        return { status: 'EXPIRED' };
      }

      // El sucesor se inserta primero por la FK replaced_by_id.
      await client.query(
        `INSERT INTO auth_schema.refresh_tokens
           (id, user_id, family_id, token_hash, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [next.id, current.user_id, current.family_id, next.tokenHash, next.expiresAt, now],
      );
      await client.query(
        `UPDATE auth_schema.refresh_tokens
         SET revoked_at = $1, replaced_by_id = $2
         WHERE id = $3`,
        [now, next.id, current.id],
      );
      await client.query('COMMIT');
      return { status: 'ROTATED', userId: current.user_id, familyId: current.family_id };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Idempotente: revocar lo ya revocado no cambia nada; un hash desconocido no actualiza filas.
  async revokeFamilyByTokenHash(tokenHash: string, now: Date): Promise<void> {
    await this.pool.query(
      `UPDATE auth_schema.refresh_tokens
       SET revoked_at = $2
       WHERE revoked_at IS NULL
         AND family_id = (SELECT family_id FROM auth_schema.refresh_tokens WHERE token_hash = $1)`,
      [tokenHash, now],
    );
  }
}
