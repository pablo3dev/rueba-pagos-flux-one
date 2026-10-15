// adapter: out — PostgreSQL (outbox en la misma transacción del cambio de estado)
import type { OutboxEvent, TransferEventType } from '../../../domain/outbox-event.js';
import type { OutboxStore } from '../../../application/ports/outbox-store.js';
import type { Queryable } from './queryable.js';

interface OutboxRow {
  id: string;
  event_type: string;
  aggregate_id: string;
  payload: OutboxEvent['payload'];
  correlation_id: string | null;
  attempts: number;
  next_attempt_at: Date;
  created_at: Date;
}

export class PgOutboxStore implements OutboxStore {
  constructor(private readonly db: Queryable) {}

  async insert(event: OutboxEvent): Promise<void> {
    await this.db.query(
      `INSERT INTO payment_schema.outbox_events
         (id, event_type, aggregate_type, aggregate_id, payload, correlation_id, attempts, next_attempt_at, created_at)
       VALUES ($1, $2, 'TRANSFER', $3, $4::jsonb, $5, 0, $6, $7)`,
      [
        event.id,
        event.eventType,
        event.aggregateId,
        JSON.stringify(event.payload),
        event.correlationId,
        event.nextAttemptAt,
        event.createdAt,
      ],
    );
  }

  async claim(now: Date, limit: number): Promise<OutboxEvent[]> {
    const result = await this.db.query<OutboxRow>(
      `SELECT id, event_type, aggregate_id, payload, correlation_id, attempts, next_attempt_at, created_at
       FROM payment_schema.outbox_events
       WHERE published_at IS NULL AND next_attempt_at <= $1
       ORDER BY created_at, id
       LIMIT $2
       FOR UPDATE SKIP LOCKED`,
      [now, limit],
    );
    return result.rows.map((row) => ({
      id: row.id,
      eventType: row.event_type as TransferEventType,
      aggregateType: 'TRANSFER',
      aggregateId: row.aggregate_id,
      payload: row.payload,
      correlationId: row.correlation_id,
      attempts: row.attempts,
      nextAttemptAt: row.next_attempt_at,
      createdAt: row.created_at,
    }));
  }

  async markPublished(id: string, now: Date): Promise<void> {
    await this.db.query(
      `UPDATE payment_schema.outbox_events SET published_at = $2 WHERE id = $1`,
      [id, now],
    );
  }

  async markRetry(id: string, attempts: number, nextAttemptAt: Date, lastError: string): Promise<void> {
    await this.db.query(
      `UPDATE payment_schema.outbox_events
       SET attempts = $2, next_attempt_at = $3, last_error = $4
       WHERE id = $1`,
      [id, attempts, nextAttemptAt, lastError],
    );
  }
}
