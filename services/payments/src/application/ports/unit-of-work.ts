// port: out — transacción única del efecto monetario, la idempotencia y el outbox
import type { AccountRepository } from './account-repository.js';
import type { IdempotencyStore } from './idempotency-store.js';
import type { OutboxStore } from './outbox-store.js';
import type { RailWorkRepository } from './rail-work-repository.js';
import type { ReversalRepository, ReversalWorkRepository } from './reversal-repository.js';
import type { TransferRepository } from './transfer-repository.js';

export interface TransactionScope {
  accounts: AccountRepository;
  transfers: TransferRepository;
  reversals: ReversalRepository;
  idempotency: IdempotencyStore;
  railWork: RailWorkRepository;
  reversalWork: ReversalWorkRepository;
  outbox: OutboxStore;
}

export interface UnitOfWorkOptions {
  timeouts: boolean;
}

export interface UnitOfWork {
  run<T>(work: (scope: TransactionScope) => Promise<T>, options?: UnitOfWorkOptions): Promise<T>;
}
