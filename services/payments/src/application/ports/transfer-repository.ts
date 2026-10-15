// port: out — transferencias que el caso de uso necesita
import type { Transfer } from '../../domain/transfer.js';

export interface TransferCursor {
  createdAt: Date;
  id: string;
}

export interface TransferRepository {
  insert(transfer: Transfer): Promise<void>;
  findById(id: string): Promise<Transfer | null>;
  findVisibleById(id: string, userId: string): Promise<Transfer | null>;
  listVisible(userId: string, page: { limit: number; after: TransferCursor | null }): Promise<Transfer[]>;
  markReversed(id: string, now: Date): Promise<boolean>;
}
