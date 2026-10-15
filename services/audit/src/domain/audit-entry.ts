import { InvalidAuditEnvelopeError } from './errors.js';

export const AUDIT_EVENT_TYPES = [
  'transfer.created',
  'transfer.completed',
  'transfer.failed',
  'transfer.unknown',
  'transfer.reversal_requested',
  'transfer.reversed',
  'transfer.reversal_rejected',
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_VISIBLE_USERS = 32;

export interface AuditEntry {
  eventId: string;
  eventType: AuditEventType;
  aggregateType: 'TRANSFER';
  aggregateId: string;
  actorUserId: string | null;
  visibleToUserIds: string[];
  correlationId: string | null;
  occurredAt: Date;
  payload: Record<string, unknown>;
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function isEventType(value: unknown): value is AuditEventType {
  return typeof value === 'string' && (AUDIT_EVENT_TYPES as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !isUuid(value)) {
    throw new InvalidAuditEnvelopeError(`invalid_${field}`);
  }
  return value.toLowerCase();
}

function readOptionalUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  return readUuid(value, field);
}

function readOptionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw new InvalidAuditEnvelopeError(`invalid_${field}`);
  }
  return value;
}

// El sobre publicado por Pagos. Un sobre que no cumple esta forma no se puede persistir.
export function parseAuditEnvelope(body: Buffer, messageId: string | undefined): AuditEntry {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.toString('utf8'));
  } catch {
    throw new InvalidAuditEnvelopeError('invalid_json');
  }
  if (!isRecord(parsed)) throw new InvalidAuditEnvelopeError('invalid_envelope');

  const eventId = readUuid(parsed.eventId, 'event_id');
  if (messageId !== undefined && messageId !== '' && messageId.toLowerCase() !== eventId) {
    throw new InvalidAuditEnvelopeError('message_id_mismatch');
  }

  if (!isEventType(parsed.eventType)) {
    throw new InvalidAuditEnvelopeError('invalid_event_type');
  }
  if (parsed.aggregateType !== 'TRANSFER') {
    throw new InvalidAuditEnvelopeError('invalid_aggregate_type');
  }

  const occurredAtRaw = parsed.occurredAt;
  if (typeof occurredAtRaw !== 'string') throw new InvalidAuditEnvelopeError('invalid_occurred_at');
  const occurredAtMs = Date.parse(occurredAtRaw);
  if (!Number.isFinite(occurredAtMs)) throw new InvalidAuditEnvelopeError('invalid_occurred_at');

  if (!Array.isArray(parsed.visibleToUserIds) || parsed.visibleToUserIds.length === 0) {
    throw new InvalidAuditEnvelopeError('invalid_visible_to_user_ids');
  }
  if (parsed.visibleToUserIds.length > MAX_VISIBLE_USERS) {
    throw new InvalidAuditEnvelopeError('invalid_visible_to_user_ids');
  }
  const visibleToUserIds = parsed.visibleToUserIds.map((userId) =>
    readUuid(userId, 'visible_to_user_ids'),
  );

  if (!isRecord(parsed.data)) throw new InvalidAuditEnvelopeError('invalid_data');

  return {
    eventId,
    eventType: parsed.eventType,
    aggregateType: 'TRANSFER',
    aggregateId: readUuid(parsed.aggregateId, 'aggregate_id'),
    actorUserId: readOptionalUuid(parsed.actorUserId, 'actor_user_id'),
    visibleToUserIds,
    correlationId: readOptionalText(parsed.correlationId, 'correlation_id', 64),
    occurredAt: new Date(occurredAtMs),
    payload: parsed.data,
  };
}
