import { debit, credit, type Account } from './account.js';
import { SameAccountError } from './errors.js';
import type { Money } from './money.js';

export type TransferType = 'INTERNAL' | 'EXTERNAL';
export type TransferStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'UNKNOWN' | 'REVERSED';
export type FailureReason = 'INSUFFICIENT_FUNDS' | 'RAIL_REJECTED' | 'RAIL_UNAVAILABLE';
export type RailOutcome =
  | 'ACCEPTED'
  | 'REJECTED'
  | 'UNAVAILABLE'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'NOT_FOUND';

export interface Transfer {
  id: string;
  ownerUserId: string;
  type: TransferType;
  fromAccountId: string;
  toAccountId: string | null;
  toExternalAccount: string | null;
  amount: Money;
  currency: 'COP';
  status: TransferStatus;
  failureReason: FailureReason | null;
  railReference: string | null;
  railAttempts: number;
  nextAttemptAt: Date | null;
  leaseUntil: Date | null;
  lastRailOutcome: RailOutcome | null;
  correlationId: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface TransferOutcome {
  transfer: Transfer;
  from: Account;
  to: Account;
}

export function executeInternalTransfer(input: {
  id: string;
  ownerUserId: string;
  from: Account;
  to: Account;
  amount: Money;
  correlationId: string | null;
  now: Date;
}): TransferOutcome {
  if (input.from.id === input.to.id) throw new SameAccountError();
  const base: Transfer = {
    id: input.id,
    ownerUserId: input.ownerUserId,
    type: 'INTERNAL',
    fromAccountId: input.from.id,
    toAccountId: input.to.id,
    toExternalAccount: null,
    amount: input.amount,
    currency: 'COP',
    status: 'COMPLETED',
    failureReason: null,
    railReference: null,
    railAttempts: 0,
    nextAttemptAt: null,
    leaseUntil: null,
    lastRailOutcome: null,
    correlationId: input.correlationId,
    createdAt: input.now,
    updatedAt: input.now,
    completedAt: input.now,
  };
  if (input.from.balance < input.amount) {
    return {
      transfer: {
        ...base,
        status: 'FAILED',
        failureReason: 'INSUFFICIENT_FUNDS',
        completedAt: null,
      },
      from: input.from,
      to: input.to,
    };
  }
  return {
    transfer: base,
    from: debit(input.from, input.amount, input.now),
    to: credit(input.to, input.amount, input.now),
  };
}
