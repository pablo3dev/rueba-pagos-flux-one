// port: in — historial paginado de transferencias visibles
import { ValidationError } from '../../domain/errors.js';
import type { TransferRepository } from '../ports/transfer-repository.js';
import { decodeCursor, encodeCursor } from '../transfer-cursor.js';
import { toTransferView, type TransferPage } from '../views.js';

export class ListTransfers {
  constructor(private readonly transfers: TransferRepository) {}

  async execute(input: { userId: string; limit?: string; cursor?: string }): Promise<TransferPage> {
    const limit = parseLimit(input.limit);
    const after = input.cursor ? decodeCursor(input.cursor) : null;
    const rows = await this.transfers.listVisible(input.userId, { limit: limit + 1, after });
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    const nextCursor = rows.length > limit && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null;
    return { items: page.map((transfer) => toTransferView(transfer)), nextCursor };
  }
}

function parseLimit(raw: string | undefined): number {
  if (raw === undefined) return 20;
  if (!/^[0-9]+$/.test(raw)) throw new ValidationError('limit debe ser un entero entre 1 y 100');
  const limit = Number(raw);
  if (limit < 1 || limit > 100) throw new ValidationError('limit debe ser un entero entre 1 y 100');
  return limit;
}
