import { formatAmount, parseAmount } from './amount.js';
import { ValidationError } from './errors.js';
import { parseParty, parseReference } from './reference.js';
import type { OperationRequest } from './requests.js';

export type OperationKind = 'TRANSFER' | 'REVERSAL';
export type OperationStatus = 'ACCEPTED' | 'REJECTED';
export type RejectionReason =
  | 'REJECTED_BY_BANK'
  | 'ORIGINAL_NOT_FOUND'
  | 'ORIGINAL_NOT_ACCEPTED'
  | 'AMOUNT_MISMATCH'
  | 'ALREADY_REVERSED';

export interface BankOperation {
  reference: string;
  kind: OperationKind;
  from?: string;
  to?: string;
  originalReference?: string;
  amount: string;
  status: OperationStatus;
  reason?: RejectionReason;
  recordedAt: string;
}

export type RecordedResult =
  { status: 'ACCEPTED' } | { status: 'REJECTED'; reason: RejectionReason };

const REJECTION_REASONS: readonly RejectionReason[] = [
  'REJECTED_BY_BANK',
  'ORIGINAL_NOT_FOUND',
  'ORIGINAL_NOT_ACCEPTED',
  'AMOUNT_MISMATCH',
  'ALREADY_REVERSED',
];

const STORED_AMOUNT_PATTERN = /^(0|[1-9][0-9]{0,15})\.[0-9]{2}$/;
const RECORDED_AT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const STORED_AMOUNT_MESSAGE =
  'El monto almacenado debe tener exactamente dos decimales y ser mayor que cero.';

export function buildOperation(
  request: OperationRequest,
  result: RecordedResult,
  recordedAt: Date,
): BankOperation {
  const amount = formatAmount(request.amountCents);
  const recorded = recordedAt.toISOString();
  if (request.kind === 'TRANSFER') {
    if (result.status === 'REJECTED') {
      return {
        reference: request.reference,
        kind: request.kind,
        from: request.from,
        to: request.to,
        amount,
        status: result.status,
        reason: result.reason,
        recordedAt: recorded,
      };
    }
    return {
      reference: request.reference,
      kind: request.kind,
      from: request.from,
      to: request.to,
      amount,
      status: result.status,
      recordedAt: recorded,
    };
  }
  if (result.status === 'REJECTED') {
    return {
      reference: request.reference,
      kind: request.kind,
      originalReference: request.originalReference,
      amount,
      status: result.status,
      reason: result.reason,
      recordedAt: recorded,
    };
  }
  return {
    reference: request.reference,
    kind: request.kind,
    originalReference: request.originalReference,
    amount,
    status: result.status,
    recordedAt: recorded,
  };
}

export function isSamePayload(existing: BankOperation, request: OperationRequest): boolean {
  if (existing.kind !== request.kind) {
    return false;
  }
  if (parseAmount(existing.amount) !== request.amountCents) {
    return false;
  }
  if (request.kind === 'TRANSFER') {
    return existing.from === request.from && existing.to === request.to;
  }
  return existing.originalReference === request.originalReference;
}

export function parseStoredOperation(raw: unknown): BankOperation {
  if (!isPlainObject(raw)) {
    throw new ValidationError('La operación almacenada debe ser un objeto.');
  }

  const reference = parseReference(readRequiredString(raw, 'reference'));
  const kind = readKind(readRequiredString(raw, 'kind'));
  const amount = parseStoredAmount(readRequiredString(raw, 'amount'));
  const status = readStatus(readRequiredString(raw, 'status'));
  const recordedAt = parseRecordedAt(readRequiredString(raw, 'recordedAt'));

  if (status === 'ACCEPTED' && Object.hasOwn(raw, 'reason')) {
    throw new ValidationError('Una operación aceptada no puede incluir un motivo.');
  }

  const allowed = new Set<string>(['reference', 'kind', 'amount', 'status', 'recordedAt']);
  if (kind === 'TRANSFER') {
    allowed.add('from');
    allowed.add('to');
  } else {
    allowed.add('originalReference');
  }
  if (status === 'REJECTED') {
    allowed.add('reason');
  }
  for (const key of Object.keys(raw)) {
    if (!allowed.has(key)) {
      throw new ValidationError('Los campos no coinciden con el tipo de operación.');
    }
  }

  if (kind === 'TRANSFER') {
    const from = parseParty(readRequiredString(raw, 'from'), 'from');
    const to = parseParty(readRequiredString(raw, 'to'), 'to');
    if (status === 'REJECTED') {
      return {
        reference,
        kind,
        from,
        to,
        amount,
        status,
        reason: readReason(raw),
        recordedAt,
      };
    }
    return { reference, kind, from, to, amount, status, recordedAt };
  }

  const originalReference = parseReference(
    readRequiredString(raw, 'originalReference'),
    'originalReference',
  );
  if (status === 'REJECTED') {
    return {
      reference,
      kind,
      originalReference,
      amount,
      status,
      reason: readReason(raw),
      recordedAt,
    };
  }
  return { reference, kind, originalReference, amount, status, recordedAt };
}

export function rejectionCode(reason: RejectionReason): string {
  if (reason === 'REJECTED_BY_BANK') {
    return 'REJECTED';
  }
  return reason;
}

function isPlainObject(raw: unknown): raw is Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(raw);
  return prototype === Object.prototype || prototype === null;
}

function readRequiredString(raw: Record<string, unknown>, field: string): string {
  if (!Object.hasOwn(raw, field)) {
    throw new ValidationError('Faltan campos de la operación almacenada.');
  }
  const value = raw[field];
  if (typeof value !== 'string') {
    throw new ValidationError('Los campos de la operación almacenada tienen un tipo incorrecto.');
  }
  return value;
}

function readKind(raw: string): OperationKind {
  if (raw !== 'TRANSFER' && raw !== 'REVERSAL') {
    throw new ValidationError('El tipo de operación almacenada es inválido.');
  }
  return raw;
}

function readStatus(raw: string): OperationStatus {
  if (raw !== 'ACCEPTED' && raw !== 'REJECTED') {
    throw new ValidationError('El estado de la operación almacenada es inválido.');
  }
  return raw;
}

function readReason(raw: Record<string, unknown>): RejectionReason {
  const reason = readRequiredString(raw, 'reason');
  if (!(REJECTION_REASONS as readonly string[]).includes(reason)) {
    throw new ValidationError('El motivo de rechazo almacenado es inválido.');
  }
  return reason as RejectionReason;
}

function parseStoredAmount(raw: string): string {
  if (!STORED_AMOUNT_PATTERN.test(raw)) {
    throw new ValidationError(STORED_AMOUNT_MESSAGE);
  }
  parseAmount(raw);
  return raw;
}

function parseRecordedAt(raw: string): string {
  if (!RECORDED_AT_PATTERN.test(raw)) {
    throw new ValidationError('La fecha de registro almacenada es inválida.');
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== raw) {
    throw new ValidationError('La fecha de registro almacenada es inválida.');
  }
  return raw;
}
