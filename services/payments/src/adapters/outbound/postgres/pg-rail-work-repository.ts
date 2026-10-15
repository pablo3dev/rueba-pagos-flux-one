// adapter: out — PostgreSQL (reclamo y guardado con fencing de transferencias externas)
import type { Transfer, TransferStatus } from '../../../domain/transfer.js';
import type { RailWorkKind, RailWorkRepository } from '../../../application/ports/rail-work-repository.js';
import type { Queryable } from './queryable.js';
import { mapTransferRow, TRANSFER_COLUMNS, type TransferRow } from './row-mapping.js';

export class PgRailWorkRepository implements RailWorkRepository {
  constructor(private readonly db: Queryable) {}

  async claim(kind: RailWorkKind, now: Date, leaseUntil: Date, limit: number): Promise<Transfer[]> {
    const variant =
      kind === 'DISPATCH'
        ? `(status = 'PENDING' OR last_rail_outcome = 'NOT_FOUND')`
        : `status = 'UNKNOWN' AND last_rail_outcome IS DISTINCT FROM 'NOT_FOUND'`;
    const selected = await this.db.query<TransferRow>(
      `SELECT ${TRANSFER_COLUMNS} FROM payment_schema.transfers
       WHERE type = 'EXTERNAL'
         AND status IN ('PENDING', 'UNKNOWN')
         AND ${variant}
         AND next_attempt_at <= $1
         AND (lease_until IS NULL OR lease_until < $1)
       ORDER BY next_attempt_at, id
       LIMIT $2
       FOR UPDATE SKIP LOCKED`,
      [now, limit],
    );
    if (selected.rows.length === 0) return [];
    const ids = selected.rows.map((row) => row.id);
    const updated = await this.db.query<TransferRow>(
      `UPDATE payment_schema.transfers SET lease_until = $2
       WHERE id = ANY($1::uuid[])
       RETURNING ${TRANSFER_COLUMNS}`,
      [ids, leaseUntil],
    );
    return updated.rows.map(mapTransferRow);
  }

  async saveGuarded(next: Transfer, expected: { status: TransferStatus; leaseUntil: Date }): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE payment_schema.transfers
       SET status = $3, failure_reason = $4, rail_attempts = $5, next_attempt_at = $6,
           lease_until = NULL, last_rail_outcome = $7, updated_at = $8, completed_at = $9
       WHERE id = $1 AND status = $2 AND lease_until = $10`,
      [
        next.id,
        expected.status,
        next.status,
        next.failureReason,
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
