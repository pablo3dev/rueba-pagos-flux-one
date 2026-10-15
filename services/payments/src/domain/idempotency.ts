import { createHash } from 'node:crypto';
import { IdempotencyKeyRequiredError } from './errors.js';

export const CREATE_TRANSFER_OPERATION = 'CREATE_TRANSFER';

const KEY_PATTERN = /^[\x21-\x7E]{1,255}$/;

export function reversalOperation(transferId: string): string {
  return `CREATE_REVERSAL:${transferId}`;
}

export function parseIdempotencyKey(raw: unknown): string {
  if (typeof raw !== 'string' || !KEY_PATTERN.test(raw)) throw new IdempotencyKeyRequiredError();
  return raw;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function computeRequestHash(operation: string, body: unknown): string {
  return createHash('sha256').update(canonicalJson(body) + operation).digest('hex');
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) sorted[key] = canonicalize(source[key]);
    return sorted;
  }
  return value;
}
