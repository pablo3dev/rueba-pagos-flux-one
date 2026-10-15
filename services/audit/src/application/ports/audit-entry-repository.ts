// port: out — persistencia append-only de audit_schema.audit_entries
import type { AuditEntry } from '../../domain/audit-entry.js';

export interface AuditEntryRepository {
  // Idempotente por event_id: INSERT ON CONFLICT DO NOTHING. La primera entrega gana;
  // una repetición (mismo eventId, aunque el cuerpo difiera) no vuelve a insertar.
  insertIfAbsent(entry: AuditEntry): Promise<'inserted' | 'duplicate'>;
  listVisible(transferId: string, userId: string): Promise<AuditEntry[]>;
}
