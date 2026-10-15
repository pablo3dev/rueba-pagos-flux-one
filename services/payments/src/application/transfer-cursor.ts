import { ValidationError } from '../domain/errors.js';
import type { TransferCursor } from './ports/transfer-repository.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeCursor(cursor: TransferCursor): string {
  return Buffer.from(JSON.stringify({ c: cursor.createdAt.toISOString(), i: cursor.id })).toString(
    'base64url',
  );
}

export function decodeCursor(raw: string): TransferCursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    throw new ValidationError('cursor inválido');
  }
  if (!parsed || typeof parsed !== 'object') throw new ValidationError('cursor inválido');
  const record = parsed as { c?: unknown; i?: unknown };
  if (typeof record.c !== 'string' || typeof record.i !== 'string') {
    throw new ValidationError('cursor inválido');
  }
  const createdAt = new Date(record.c);
  if (Number.isNaN(createdAt.getTime()) || createdAt.toISOString() !== record.c) {
    throw new ValidationError('cursor inválido');
  }
  if (!UUID.test(record.i)) throw new ValidationError('cursor inválido');
  return { createdAt, id: record.i };
}
