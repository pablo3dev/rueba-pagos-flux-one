// adapter: out — PostgreSQL audit_schema.audit_entries
import type { Pool } from 'pg';
import type { AuditEntryRepository } from '../../../application/ports/audit-entry-repository.js';
import type { AuditEntry, AuditEventType } from '../../../domain/audit-entry.js';

interface AuditEntryRow {
  event_id: string;
  event_type: AuditEventType;
  aggregate_type: 'TRANSFER';
  aggregate_id: string;
  actor_user_id: string | null;
  visible_to_user_ids: string[];
  correlation_id: string | null;
  occurred_at: Date;
  payload: Record<string, unknown>;
}

function toEntry(row: AuditEntryRow): AuditEntry {
  return {
    eventId: row.event_id,
    eventType: row.event_type,
    aggregateType: 'TRANSFER',
    aggregateId: row.aggregate_id,
    actorUserId: row.actor_user_id,
    visibleToUserIds: row.visible_to_user_ids,
    correlationId: row.correlation_id,
    occurredAt: row.occurred_at,
    payload: row.payload,
  };
}

export class PgAuditEntryRepository implements AuditEntryRepository {
  constructor(private readonly pool: Pool) {}

  // Idempotente por event_id (PK): ON CONFLICT DO NOTHING. La repetición no reescribe la fila.
  async insertIfAbsent(entry: AuditEntry): Promise<'inserted' | 'duplicate'> {
    const result = await this.pool.query(
      `INSERT INTO audit_schema.audit_entries (
         event_id, event_type, aggregate_type, aggregate_id, actor_user_id,
         visible_to_user_ids, correlation_id, occurred_at, payload
       ) VALUES ($1, $2, $3, $4, $5, $6::uuid[], $7, $8, $9::jsonb)
       ON CONFLICT (event_id) DO NOTHING`,
      [
        entry.eventId,
        entry.eventType,
        entry.aggregateType,
        entry.aggregateId,
        entry.actorUserId,
        entry.visibleToUserIds,
        entry.correlationId,
        entry.occurredAt,
        JSON.stringify(entry.payload),
      ],
    );
    return result.rowCount === 1 ? 'inserted' : 'duplicate';
  }

  async listVisible(transferId: string, userId: string): Promise<AuditEntry[]> {
    const result = await this.pool.query<AuditEntryRow>(
      `SELECT event_id, event_type, aggregate_type, aggregate_id, actor_user_id,
              visible_to_user_ids, correlation_id, occurred_at, payload
         FROM audit_schema.audit_entries
        WHERE aggregate_id = $1
          AND visible_to_user_ids @> ARRAY[$2]::uuid[]
        ORDER BY occurred_at ASC, event_id ASC`,
      [transferId, userId],
    );
    return result.rows.map(toEntry);
  }
}
