import { credit, debit, type Account } from './account.js';
import {
  InvalidTransferTransitionError,
  TransferAlreadyReversedError,
  TransferNotReversibleError,
  ReversalInsufficientFundsError,
} from './errors.js';
import { backoffSeconds, MAX_SUBMIT_ATTEMPTS } from './external-transfer.js';
import type { RailOutcome, Transfer } from './transfer.js';

export type ReversalStatus = 'PENDING' | 'COMPLETED' | 'REJECTED' | 'UNKNOWN';
export type RejectionReason = 'RAIL_REJECTED' | 'RAIL_UNAVAILABLE';

export interface Reversal {
  id: string;
  transferId: string;
  requestedByUserId: string;
  amount: bigint;
  status: ReversalStatus;
  rejectionReason: RejectionReason | null;
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

export interface InternalReversalPlan {
  transfer: Transfer;
  from: Account;
  to: Account;
  reversal: Reversal;
}

export function planInternalReversal(input: {
  reversalId: string;
  transfer: Transfer;
  from: Account;
  to: Account;
  requestedByUserId: string;
  correlationId: string | null;
  now: Date;
}): InternalReversalPlan {
  assertReversible(input.transfer, input.requestedByUserId, 'INTERNAL');
  if (!input.to.id || input.transfer.toAccountId !== input.to.id) {
    throw new TransferNotReversibleError();
  }
  if (input.to.balance < input.transfer.amount) throw new ReversalInsufficientFundsError();
  return {
    from: credit(input.from, input.transfer.amount, input.now),
    to: debit(input.to, input.transfer.amount, input.now),
    transfer: { ...input.transfer, status: 'REVERSED', updatedAt: input.now },
    reversal: born(input, 'COMPLETED', null, null, input.now),
  };
}

export function planExternalReversal(input: {
  reversalId: string;
  transfer: Transfer;
  requestedByUserId: string;
  correlationId: string | null;
  now: Date;
}): Reversal {
  assertReversible(input.transfer, input.requestedByUserId, 'EXTERNAL');
  return born(input, 'PENDING', input.reversalId, input.now, null);
}

export function nextReversalAction(reversal: Reversal): 'SUBMIT' | 'QUERY' {
  if (reversal.status === 'PENDING') return 'SUBMIT';
  if (reversal.status === 'UNKNOWN' && reversal.lastRailOutcome === 'NOT_FOUND') return 'SUBMIT';
  if (reversal.status === 'UNKNOWN') return 'QUERY';
  throw new InvalidTransferTransitionError();
}

export interface ReversalTransition {
  next: Reversal;
  creditOrigin: boolean;
  reverseTransfer: boolean;
}

export function applyReversalSubmitOutcome(
  reversal: Reversal,
  outcome: Exclude<RailOutcome, 'NOT_FOUND'>,
  now: Date,
): ReversalTransition {
  if (nextReversalAction(reversal) !== 'SUBMIT') throw new InvalidTransferTransitionError();
  return applyReversalOutcome(reversal, outcome, now, true);
}

export function applyReversalQueryOutcome(
  reversal: Reversal,
  outcome: RailOutcome,
  now: Date,
): ReversalTransition {
  if (nextReversalAction(reversal) !== 'QUERY') throw new InvalidTransferTransitionError();
  return applyReversalOutcome(reversal, outcome, now, false);
}

function assertReversible(
  transfer: Transfer,
  userId: string,
  type: 'INTERNAL' | 'EXTERNAL',
): void {
  if (transfer.ownerUserId !== userId || transfer.type !== type) {
    throw new TransferNotReversibleError();
  }
  if (transfer.status === 'REVERSED') throw new TransferAlreadyReversedError();
  if (transfer.status !== 'COMPLETED') throw new TransferNotReversibleError();
}

function born(
  input: {
    reversalId: string;
    transfer: Transfer;
    requestedByUserId: string;
    correlationId: string | null;
    now: Date;
  },
  status: 'PENDING' | 'COMPLETED',
  railReference: string | null,
  nextAttemptAt: Date | null,
  completedAt: Date | null,
): Reversal {
  return {
    id: input.reversalId,
    transferId: input.transfer.id,
    requestedByUserId: input.requestedByUserId,
    amount: input.transfer.amount,
    status,
    rejectionReason: null,
    railReference,
    railAttempts: 0,
    nextAttemptAt,
    leaseUntil: null,
    lastRailOutcome: null,
    correlationId: input.correlationId,
    createdAt: input.now,
    updatedAt: input.now,
    completedAt,
  };
}

function applyReversalOutcome(
  reversal: Reversal,
  outcome: RailOutcome,
  now: Date,
  submit: boolean,
): ReversalTransition {
  const resubmit = reversal.status === 'UNKNOWN' && reversal.lastRailOutcome === 'NOT_FOUND';
  if (outcome === 'ACCEPTED') {
    return {
      next: touch(reversal, now, {
        status: 'COMPLETED',
        rejectionReason: null,
        lastRailOutcome: 'ACCEPTED',
        nextAttemptAt: null,
        completedAt: now,
      }),
      creditOrigin: true,
      reverseTransfer: true,
    };
  }
  if (outcome === 'REJECTED') {
    return {
      next: touch(reversal, now, {
        status: 'REJECTED',
        rejectionReason: 'RAIL_REJECTED',
        lastRailOutcome: 'REJECTED',
        nextAttemptAt: null,
        completedAt: now,
      }),
      creditOrigin: false,
      reverseTransfer: false,
    };
  }
  if (outcome === 'NOT_FOUND') {
    return {
      next: touch(reversal, now, {
        status: 'UNKNOWN',
        railAttempts: 0,
        lastRailOutcome: 'NOT_FOUND',
        nextAttemptAt: now,
        rejectionReason: null,
        completedAt: null,
      }),
      creditOrigin: false,
      reverseTransfer: false,
    };
  }
  if (outcome === 'UNAVAILABLE') {
    const attempts = reversal.railAttempts + 1;
    if (submit && attempts >= MAX_SUBMIT_ATTEMPTS) {
      return {
        next: touch(reversal, now, {
          status: 'REJECTED',
          rejectionReason: 'RAIL_UNAVAILABLE',
          railAttempts: attempts,
          lastRailOutcome: 'UNAVAILABLE',
          nextAttemptAt: null,
          completedAt: now,
        }),
        creditOrigin: false,
        reverseTransfer: false,
      };
    }
    return {
      next: touch(reversal, now, {
        status: resubmit || !submit ? 'UNKNOWN' : 'PENDING',
        railAttempts: attempts,
        lastRailOutcome: resubmit ? 'NOT_FOUND' : 'UNAVAILABLE',
        nextAttemptAt: addSeconds(now, backoffSeconds(attempts)),
        rejectionReason: null,
        completedAt: null,
      }),
      creditOrigin: false,
      reverseTransfer: false,
    };
  }
  return {
    next: touch(reversal, now, {
      status: 'UNKNOWN',
      railAttempts: submit ? 0 : reversal.railAttempts + 1,
      lastRailOutcome: outcome,
      nextAttemptAt: addSeconds(now, backoffSeconds(submit ? 0 : reversal.railAttempts + 1)),
      rejectionReason: null,
      completedAt: null,
    }),
    creditOrigin: false,
    reverseTransfer: false,
  };
}

function touch(reversal: Reversal, now: Date, patch: Partial<Reversal>): Reversal {
  return { ...reversal, ...patch, updatedAt: now, leaseUntil: null };
}

function addSeconds(now: Date, seconds: number): Date {
  return new Date(now.getTime() + seconds * 1000);
}
