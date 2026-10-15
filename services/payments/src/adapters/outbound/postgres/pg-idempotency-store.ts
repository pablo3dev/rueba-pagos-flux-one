// adapter: out — PostgreSQL (claves de idempotencia)
import { timingSafeEqual } from 'node:crypto';
import { IdempotencyKeyInProgressError } from '../../../domain/errors.js';
import type {
  BeginResult,
  IdempotencyScope,
  IdempotencyStore,
} from '../../../application/ports/idempotency-store.js';
import type { Queryable } from './queryable.js';
import { isPgError } from './row-mapping.js';

export class PgIdempotencyStore implements IdempotencyStore {
  constructor(private readonly db: Queryable) {}

  async begin(scope: IdempotencyScope, requestHash: string, now: Date): Promise<BeginResult> {
    let inserted;
    try {
      inserted = await this.db.query(
        `INSERT INTO payment_schema.idempotency_keys
           (user_id, operation, idempotency_key, request_hash, status, created_at)
         VALUES ($1, $2, $3, $4, 'IN_PROGRESS', $5)
         ON CONFLICT (user_id, operation, idempotency_key) DO NOTHING`,
        [scope.userId, scope.operation, scope.key, requestHash, now],
      );
    } catch (error) {
      if (isPgError(error) && (error.code === '55P03' || error.code === '57014')) {
        throw new IdempotencyKeyInProgressError();
      }
      throw error;
    }
    if (inserted.rowCount === 1) return { kind: 'ACQUIRED' };
    const existing = await this.db.query<{
      request_hash: string;
      status: string;
      response_status: number | null;
      response_body: unknown;
    }>(
      `SELECT request_hash, status, response_status, response_body
       FROM payment_schema.idempotency_keys
       WHERE user_id = $1 AND operation = $2 AND idempotency_key = $3`,
      [scope.userId, scope.operation, scope.key],
    );
    const row = existing.rows[0];
    if (!row || row.status !== 'COMPLETED' || row.response_status === null) {
      throw new IdempotencyKeyInProgressError();
    }
    if (!sameHash(row.request_hash, requestHash)) return { kind: 'MISMATCH' };
    return { kind: 'REPLAY', status: row.response_status, body: row.response_body };
  }

  async complete(
    scope: IdempotencyScope,
    response: { status: number; body: unknown; resourceId: string },
    now: Date,
  ): Promise<void> {
    await this.db.query(
      `UPDATE payment_schema.idempotency_keys
       SET status = 'COMPLETED', response_status = $4, response_body = $5::jsonb,
           resource_id = $6, completed_at = $7
       WHERE user_id = $1 AND operation = $2 AND idempotency_key = $3`,
      [scope.userId, scope.operation, scope.key, response.status, JSON.stringify(response.body), response.resourceId, now],
    );
  }
}

function sameHash(stored: string, incoming: string): boolean {
  const left = Buffer.from(stored);
  const right = Buffer.from(incoming);
  return left.length === right.length && timingSafeEqual(left, right);
}
