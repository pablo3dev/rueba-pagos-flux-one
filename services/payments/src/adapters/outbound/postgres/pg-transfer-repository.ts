// adapter: out — PostgreSQL (transferencias en payment_schema)
import { formatMoney } from '../../../domain/money.js';
import type { Transfer } from '../../../domain/transfer.js';
import type { TransferCursor, TransferRepository } from '../../../application/ports/transfer-repository.js';
import type { Queryable } from './queryable.js';
import { mapTransferRow, TRANSFER_COLUMNS, type TransferRow } from './row-mapping.js';

const VISIBLE = `EXISTS (
  SELECT 1 FROM payment_schema.accounts a
  WHERE a.owner_user_id = $1
    AND (a.id = t.from_account_id OR (t.type = 'INTERNAL' AND a.id = t.to_account_id))
)`;

export class PgTransferRepository implements TransferRepository {
  constructor(private readonly db: Queryable) {}

  async insert(transfer: Transfer): Promise<void> {
    await this.db.query(
      `INSERT INTO payment_schema.transfers (
         id, owner_user_id, type, from_account_id, to_account_id, to_external_account,
         amount, currency, status, failure_reason, rail_reference, rail_attempts,
         next_attempt_at, lease_until, last_rail_outcome, correlation_id, created_at, updated_at, completed_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7::numeric,'COP',$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
       )`,
      [
        transfer.id,
        transfer.ownerUserId,
        transfer.type,
        transfer.fromAccountId,
        transfer.toAccountId,
        transfer.toExternalAccount,
        formatMoney(transfer.amount),
        transfer.status,
        transfer.failureReason,
        transfer.railReference,
        transfer.railAttempts,
        transfer.nextAttemptAt,
        transfer.leaseUntil,
        transfer.lastRailOutcome,
        transfer.correlationId,
        transfer.createdAt,
        transfer.updatedAt,
        transfer.completedAt,
      ],
    );
  }

  async findById(id: string): Promise<Transfer | null> {
    const result = await this.db.query<TransferRow>(
      `SELECT ${TRANSFER_COLUMNS} FROM payment_schema.transfers WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? mapTransferRow(row) : null;
  }

  async findVisibleById(id: string, userId: string): Promise<Transfer | null> {
    const result = await this.db.query<TransferRow>(
      `SELECT ${TRANSFER_COLUMNS} FROM payment_schema.transfers t WHERE t.id = $2 AND ${VISIBLE}`,
      [userId, id],
    );
    const row = result.rows[0];
    return row ? mapTransferRow(row) : null;
  }

  async listVisible(
    userId: string,
    page: { limit: number; after: TransferCursor | null },
  ): Promise<Transfer[]> {
    const params: unknown[] = [userId];
    let cursor = '';
    if (page.after) {
      params.push(page.after.createdAt, page.after.id);
      cursor = `AND (t.created_at, t.id) < ($2::timestamptz, $3::uuid)`;
    }
    params.push(page.limit);
    const limitParam = `$${params.length}`;
    const result = await this.db.query<TransferRow>(
      `SELECT ${TRANSFER_COLUMNS} FROM payment_schema.transfers t
       WHERE ${VISIBLE} ${cursor}
       ORDER BY t.created_at DESC, t.id DESC
       LIMIT ${limitParam}`,
      params,
    );
    return result.rows.map(mapTransferRow);
  }

  async markReversed(id: string, now: Date): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE payment_schema.transfers SET status = 'REVERSED', updated_at = $2
       WHERE id = $1 AND status = 'COMPLETED'`,
      [id, now],
    );
    return result.rowCount === 1;
  }
}
