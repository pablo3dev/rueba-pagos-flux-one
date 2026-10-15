import { parseAmount } from './amount.js';
import { ValidationError } from './errors.js';
import { parseParty, parseReference } from './reference.js';

export interface TransferRequest {
  kind: 'TRANSFER';
  reference: string;
  from: string;
  to: string;
  amountCents: bigint;
}

export interface ReversalRequest {
  kind: 'REVERSAL';
  reference: string;
  originalReference: string;
  amountCents: bigint;
}

export type OperationRequest = TransferRequest | ReversalRequest;

const TRANSFER_KEYS = ['reference', 'from', 'to', 'amount'] as const;
const REVERSAL_KEYS = ['reference', 'originalReference', 'amount'] as const;

function isPlainObject(raw: unknown): raw is Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(raw);
  return prototype === Object.prototype || prototype === null;
}

function parseRequestObject(raw: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!isPlainObject(raw)) {
    throw new ValidationError('La solicitud debe ser un objeto.');
  }
  for (const key of keys) {
    if (!Object.hasOwn(raw, key)) {
      throw new ValidationError(`Falta el campo ${key}.`);
    }
  }
  for (const key of Object.keys(raw)) {
    if (!keys.includes(key)) {
      throw new ValidationError('La solicitud contiene campos no permitidos.');
    }
  }
  return raw;
}

export function parseTransferRequest(raw: unknown): TransferRequest {
  const body = parseRequestObject(raw, TRANSFER_KEYS);
  return {
    kind: 'TRANSFER',
    reference: parseReference(body.reference),
    from: parseParty(body.from, 'from'),
    to: parseParty(body.to, 'to'),
    amountCents: parseAmount(body.amount),
  };
}

export function parseReversalRequest(raw: unknown): ReversalRequest {
  const body = parseRequestObject(raw, REVERSAL_KEYS);
  return {
    kind: 'REVERSAL',
    reference: parseReference(body.reference),
    originalReference: parseReference(body.originalReference, 'originalReference'),
    amountCents: parseAmount(body.amount),
  };
}
