import { debit, type Account } from './account.js';
import { InvalidTransferTransitionError, ValidationError } from './errors.js';
import type { Money } from './money.js';
import type { RailOutcome, Transfer } from './transfer.js';

export const MAX_SUBMIT_ATTEMPTS = 5;
export const MAX_BACKOFF_SECONDS = 30;

const EXTERNAL_ACCOUNT = /^[A-Z0-9-]{6,34}$/;

export function parseExternalAccount(raw: unknown): string {
  if (typeof raw !== 'string' || !EXTERNAL_ACCOUNT.test(raw)) {
    throw new ValidationError('toExternalAccount: formato inválido');
  }
  return raw;
}

export function backoffSeconds(attempts: number): number {
  if (attempts >= 5) return MAX_BACKOFF_SECONDS;
  return Math.min(2 ** attempts, MAX_BACKOFF_SECONDS);
}

export function createExternalTransfer(input: {
  id: string;
  ownerUserId: string;
  from: Account;
  toExternalAccount: string;
  amount: Money;
  correlationId: string | null;
  now: Date;
}): { transfer: Transfer; from: Account } {
  const shared: Transfer = {
    id: input.id,
    ownerUserId: input.ownerUserId,
    type: 'EXTERNAL',
    fromAccountId: input.from.id,
    toAccountId: null,
    toExternalAccount: input.toExternalAccount,
    amount: input.amount,
    currency: 'COP',
    status: 'PENDING',
    failureReason: null,
    railReference: input.id,
    railAttempts: 0,
    nextAttemptAt: input.now,
    leaseUntil: null,
    lastRailOutcome: null,
    correlationId: input.correlationId,
    createdAt: input.now,
    updatedAt: input.now,
    completedAt: null,
  };
  if (input.from.balance < input.amount) {
    return {
      transfer: {
        ...shared,
        status: 'FAILED',
        failureReason: 'INSUFFICIENT_FUNDS',
        nextAttemptAt: null,
      },
      from: input.from,
    };
  }
  return { transfer: shared, from: debit(input.from, input.amount, input.now) };
}

export function nextRailAction(transfer: Transfer): 'SUBMIT' | 'QUERY' {
  if (transfer.type !== 'EXTERNAL') throw new InvalidTransferTransitionError();
  if (transfer.status === 'PENDING') return 'SUBMIT';
  if (transfer.status === 'UNKNOWN' && transfer.lastRailOutcome === 'NOT_FOUND') return 'SUBMIT';
  if (transfer.status === 'UNKNOWN') return 'QUERY';
  throw new InvalidTransferTransitionError();
}

export interface RailTransition {
  next: Transfer;
  refund: boolean;
}

export function applySubmitOutcome(
  transfer: Transfer,
  outcome: Exclude<RailOutcome, 'NOT_FOUND'>,
  now: Date,
): RailTransition {
  if (nextRailAction(transfer) !== 'SUBMIT') throw new InvalidTransferTransitionError();
  return applyOutcome(transfer, outcome, now, true);
}

export function applyQueryOutcome(
  transfer: Transfer,
  outcome: RailOutcome,
  now: Date,
): RailTransition {
  if (nextRailAction(transfer) !== 'QUERY') throw new InvalidTransferTransitionError();
  return applyOutcome(transfer, outcome, now, false);
}

function applyOutcome(
  transfer: Transfer,
  outcome: RailOutcome,
  now: Date,
  submit: boolean,
): RailTransition {
  const resubmit = transfer.status === 'UNKNOWN' && transfer.lastRailOutcome === 'NOT_FOUND';
  if (outcome === 'ACCEPTED') {
    return {
      next: touch(transfer, now, {
        status: 'COMPLETED',
        failureReason: null,
        lastRailOutcome: 'ACCEPTED',
        nextAttemptAt: null,
        completedAt: now,
      }),
      refund: false,
    };
  }
  if (outcome === 'REJECTED') {
    return {
      next: touch(transfer, now, {
        status: 'FAILED',
        failureReason: 'RAIL_REJECTED',
        lastRailOutcome: 'REJECTED',
        nextAttemptAt: null,
        completedAt: now,
      }),
      refund: true,
    };
  }
  if (outcome === 'NOT_FOUND') {
    return {
      next: touch(transfer, now, {
        status: 'UNKNOWN',
        railAttempts: 0,
        lastRailOutcome: 'NOT_FOUND',
        nextAttemptAt: now,
        completedAt: null,
        failureReason: null,
      }),
      refund: false,
    };
  }
  if (outcome === 'UNAVAILABLE') {
    const attempts = transfer.railAttempts + 1;
    if (submit && attempts >= MAX_SUBMIT_ATTEMPTS) {
      return {
        next: touch(transfer, now, {
          status: 'FAILED',
          failureReason: 'RAIL_UNAVAILABLE',
          railAttempts: attempts,
          lastRailOutcome: 'UNAVAILABLE',
          nextAttemptAt: null,
          completedAt: now,
        }),
        refund: true,
      };
    }
    return {
      next: touch(transfer, now, {
        status: resubmit || !submit ? 'UNKNOWN' : 'PENDING',
        railAttempts: attempts,
        lastRailOutcome: resubmit ? 'NOT_FOUND' : 'UNAVAILABLE',
        nextAttemptAt: addSeconds(now, backoffSeconds(attempts)),
        completedAt: null,
        failureReason: null,
      }),
      refund: false,
    };
  }
  return {
    next: touch(transfer, now, {
      status: 'UNKNOWN',
      railAttempts: submit ? 0 : transfer.railAttempts + 1,
      lastRailOutcome: outcome,
      nextAttemptAt: addSeconds(now, backoffSeconds(submit ? 0 : transfer.railAttempts + 1)),
      completedAt: null,
      failureReason: null,
    }),
    refund: false,
  };
}

function touch(transfer: Transfer, now: Date, patch: Partial<Transfer>): Transfer {
  return { ...transfer, ...patch, updatedAt: now, leaseUntil: null };
}

function addSeconds(now: Date, seconds: number): Date {
  return new Date(now.getTime() + seconds * 1000);
}
