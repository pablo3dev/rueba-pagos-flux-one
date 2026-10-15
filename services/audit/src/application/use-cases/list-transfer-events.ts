// port: in — historial de auditoría de una transferencia visible para el usuario
import type { AuditEntry } from '../../domain/audit-entry.js';
import { isUuid } from '../../domain/audit-entry.js';
import { NotFoundError, ValidationError } from '../../domain/errors.js';
import type { AuditEntryRepository } from '../ports/audit-entry-repository.js';

export async function listTransferEvents(
  input: { transferId: string; userId: string },
  repository: AuditEntryRepository,
): Promise<AuditEntry[]> {
  if (!isUuid(input.transferId)) {
    throw new ValidationError('transferId debe ser un UUID');
  }
  const events = await repository.listVisible(input.transferId, input.userId);
  if (events.length === 0) throw new NotFoundError();
  return events;
}
