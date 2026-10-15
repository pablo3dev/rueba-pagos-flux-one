import { moneyFromDb } from '../../../domain/money.js';
import type { Reversal, RejectionReason, ReversalStatus } from '../../../domain/reversal.js';
import type { FailureReason, RailOutcome, Transfer, TransferStatus, TransferType } from '../../../domain/transfer.js';

export const TRANSFER_COLUMNS = `id, owner_user_id, type, from_account_id, to_account_id, to_external_account,
  amount::text AS amount, currency, status, failure_reason, rail_reference, rail_attempts, next_attempt_at,
  lease_until, last_rail_outcome, correlation_id, created_at, updated_at, completed_at`;

export interface TransferRow {
  id: string;
  owner_user_id: string;
  type: string;
  from_account_id: string;
  to_account_id: string | null;
  to_external_account: string | null;
  amount: string;
  currency: string;
  status: string;
  failure_reason: string | null;
  rail_reference: string | null;
  rail_attempts: number;
  next_attempt_at: Date | null;
  lease_until: Date | null;
  last_rail_outcome: string | null;
  correlation_id: string | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

export function mapTransferRow(row: TransferRow): Transfer {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    type: row.type as TransferType,
    fromAccountId: row.from_account_id,
    toAccountId: row.to_account_id,
    toExternalAccount: row.to_external_account,
    amount: moneyFromDb(row.amount),
    currency: 'COP',
    status: row.status as TransferStatus,
    failureReason: row.failure_reason as FailureReason | null,
    railReference: row.rail_reference,
    railAttempts: row.rail_attempts,
    nextAttemptAt: row.next_attempt_at,
    leaseUntil: row.lease_until,
    lastRailOutcome: row.last_rail_outcome as RailOutcome | null,
    correlationId: row.correlation_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

export const REVERSAL_COLUMNS = `id, transfer_id, requested_by_user_id, amount::text AS amount, status,
  rejection_reason, rail_reference, rail_attempts, next_attempt_at, lease_until, last_rail_outcome,
  correlation_id, created_at, updated_at, completed_at`;

export interface ReversalRow {
  id: string;
  transfer_id: string;
  requested_by_user_id: string;
  amount: string;
  status: string;
  rejection_reason: string | null;
  rail_reference: string | null;
  rail_attempts: number;
  next_attempt_at: Date | null;
  lease_until: Date | null;
  last_rail_outcome: string | null;
  correlation_id: string | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

export function mapReversalRow(row: ReversalRow): Reversal {
  return {
    id: row.id,
    transferId: row.transfer_id,
    requestedByUserId: row.requested_by_user_id,
    amount: moneyFromDb(row.amount),
    status: row.status as ReversalStatus,
    rejectionReason: row.rejection_reason as RejectionReason | null,
    railReference: row.rail_reference,
    railAttempts: row.rail_attempts,
    nextAttemptAt: row.next_attempt_at,
    leaseUntil: row.lease_until,
    lastRailOutcome: row.last_rail_outcome as RailOutcome | null,
    correlationId: row.correlation_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

export function isPgError(error: unknown): error is { code: string; constraint?: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}
