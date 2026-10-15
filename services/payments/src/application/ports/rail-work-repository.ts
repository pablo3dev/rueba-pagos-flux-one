// port: out — trabajo de riel que el caso de uso necesita
import type { Transfer, TransferStatus } from '../../domain/transfer.js';

export type RailWorkKind = 'DISPATCH' | 'RECONCILE';

export interface RailWorkRepository {
  claim(kind: RailWorkKind, now: Date, leaseUntil: Date, limit: number): Promise<Transfer[]>;
  saveGuarded(next: Transfer, expected: { status: TransferStatus; leaseUntil: Date }): Promise<boolean>;
}
