// port: in — registrar un evento de auditoría entregado por el broker
import type { AuditEntryRepository } from '../ports/audit-entry-repository.js';
import { parseAuditEnvelope } from '../../domain/audit-entry.js';
import { InvalidAuditEnvelopeError } from '../../domain/errors.js';

export type ConsumeOutcome =
  | {
      action: 'ack';
      kind: 'inserted' | 'duplicate';
      eventId: string;
      correlationId: string | null;
    }
  | { action: 'requeue'; eventId: string | null; correlationId: string | null }
  | { action: 'dead-letter'; reason: string };

// Idempotente por eventId: la inserción es ON CONFLICT DO NOTHING y el ack ocurre
// solo después de que esa escritura confirma. Un sobre inválido no se reintenta (DLQ).
// Un fallo de persistencia sí se reencola hasta el delivery-limit del quorum.
export async function recordAuditEvent(
  input: { body: Buffer; messageId: string | undefined },
  repository: AuditEntryRepository,
): Promise<ConsumeOutcome> {
  let entry;
  try {
    entry = parseAuditEnvelope(input.body, input.messageId);
  } catch (error) {
    const reason = error instanceof InvalidAuditEnvelopeError ? error.reason : 'invalid_envelope';
    return { action: 'dead-letter', reason };
  }

  try {
    const kind = await repository.insertIfAbsent(entry);
    return { action: 'ack', kind, eventId: entry.eventId, correlationId: entry.correlationId };
  } catch {
    return { action: 'requeue', eventId: entry.eventId, correlationId: entry.correlationId };
  }
}
