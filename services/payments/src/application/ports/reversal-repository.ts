// port: out — reversos que el caso de uso necesita
import type { Reversal, ReversalStatus } from '../../domain/reversal.js';

export type ReversalWorkKind = 'DISPATCH' | 'RECONCILE';

export interface ReversalRepository {
  insert(reversal: Reversal): Promise<void>;
  findLatestByTransferId(transferId: string): Promise<Reversal | null>;
  findActiveByTransferId(transferId: string): Promise<Reversal | null>;
}

export interface ReversalWorkRepository {
  claim(kind: ReversalWorkKind, now: Date, leaseUntil: Date, limit: number): Promise<Reversal[]>;
  saveGuarded(
    next: Reversal,
    expected: { status: ReversalStatus; leaseUntil: Date },
  ): Promise<boolean>;
}
