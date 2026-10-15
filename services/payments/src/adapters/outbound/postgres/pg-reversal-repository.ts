// adapter: out — PostgreSQL (reversos y su trabajo de riel)
import { formatMoney } from '../../../domain/money.js';
import { TransferAlreadyReversedError } from '../../../domain/errors.js';
import type { Reversal, ReversalStatus } from '../../../domain/reversal.js';
import type {
  ReversalRepository,
  ReversalWorkKind,
  ReversalWorkRepository,
} from '../../../application/ports/reversal-repository.js';
import type { Queryable } from './queryable.js';
import { isPgError, mapReversalRow, REVERSAL_COLUMNS, type ReversalRow } from './row-mapping.js';

export class PgReversalRepository implements ReversalRepository {
  constructor(private readonly db: Queryable) {}

  async insert(reversal: Reversal): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO payment_schema.reversals (
           id, transfer_id, requested_by_user_id, amount, status, rejection_reason, rail_reference,
           rail_attempts, next_attempt_at, lease_until, last_rail_outcome, correlation_id,
           created_at, updated_at, completed_at
         ) VALUES ($1,$2,$3,$4::numeric,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          reversal.id,
          reversal.transferId,
          reversal.requestedByUserId,
          formatMoney(reversal.amount),
          reversal.status,
          reversal.rejectionReason,
          reversal.railReference,
          reversal.railAttempts,
          reversal.nextAttemptAt,
          reversal.leaseUntil,
          reversal.lastRailOutcome,
          reversal.correlationId,
          reversal.createdAt,
          reversal.updatedAt,
          reversal.completedAt,
        ],
      );
    } catch (error) {
      if (isPgError(error) && error.code === '23505') throw new TransferAlreadyReversedError();
      throw error;
    }
  }

  async findLatestByTransferId(transferId: string): Promise<Reversal | null> {
    const result = await this.db.query<ReversalRow>(
      `SELECT ${REVERSAL_COLUMNS} FROM payment_schema.reversals
       WHERE transfer_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [transferId],
    );
    const row = result.rows[0];
    return row ? mapReversalRow(row) : null;
  }

  async findActiveByTransferId(transferId: string): Promise<Reversal | null> {
    const result = await this.db.query<ReversalRow>(
      `SELECT ${REVERSAL_COLUMNS} FROM payment_schema.reversals
       WHERE transfer_id = $1 AND status IN ('PENDING', 'UNKNOWN', 'COMPLETED')
       LIMIT 1`,
      [transferId],
    );
    const row = result.rows[0];
    return row ? mapReversalRow(row) : null;
  }
}

export class PgReversalWorkRepository implements ReversalWorkRepository {
  constructor(private readonly db: Queryable) {}

  async claim(kind: ReversalWorkKind, now: Date, leaseUntil: Date, limit: number): Promise<Reversal[]> {
    const variant =
      kind === 'DISPATCH'
        ? `(status = 'PENDING' OR last_rail_outcome = 'NOT_FOUND')`
        : `status = 'UNKNOWN' AND last_rail_outcome IS DISTINCT FROM 'NOT_FOUND'`;
    const selected = await this.db.query<ReversalRow>(
      `SELECT ${REVERSAL_COLUMNS} FROM payment_schema.reversals
       WHERE status IN ('PENDING', 'UNKNOWN')
         AND ${variant}
         AND next_attempt_at <= $1
         AND (lease_until IS NULL OR lease_until < $1)
       ORDER BY next_attempt_at, id
       LIMIT $2
       FOR UPDATE SKIP LOCKED`,
      [now, limit],
    );
    if (selected.rows.length === 0) return [];
    const updated = await this.db.query<ReversalRow>(
      `UPDATE payment_schema.reversals SET lease_until = $2
       WHERE id = ANY($1::uuid[])
       RETURNING ${REVERSAL_COLUMNS}`,
      [selected.rows.map((row) => row.id), leaseUntil],
    );
    return updated.rows.map(mapReversalRow);
  }

  async saveGuarded(
    next: Reversal,
    expected: { status: ReversalStatus; leaseUntil: Date },
  ): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE payment_schema.reversals
       SET status = $3, rejection_reason = $4, rail_attempts = $5, next_attempt_at = $6,
           lease_until = NULL, last_rail_outcome = $7, updated_at = $8, completed_at = $9
       WHERE id = $1 AND status = $2 AND lease_until = $10`,
      [
        next.id,
        expected.status,
        next.status,
        next.rejectionReason,
        next.railAttempts,
        next.nextAttemptAt,
        next.lastRailOutcome,
        next.updatedAt,
        next.completedAt,
        expected.leaseUntil,
      ],
    );
    return result.rowCount === 1;
  }
}
