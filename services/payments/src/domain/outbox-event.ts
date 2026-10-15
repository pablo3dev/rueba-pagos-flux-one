import { formatMoney } from './money.js';
import type { Reversal } from './reversal.js';
import type { Transfer, TransferStatus } from './transfer.js';

export type TransferEventType =
  | 'transfer.created'
  | 'transfer.completed'
  | 'transfer.failed'
  | 'transfer.unknown'
  | 'transfer.reversal_requested'
  | 'transfer.reversed'
  | 'transfer.reversal_rejected';

export interface OutboxEnvelope {
  eventId: string;
  eventType: TransferEventType;
  occurredAt: string;
  aggregateType: 'TRANSFER';
  aggregateId: string;
  correlationId: string | null;
  actorUserId: string | null;
  visibleToUserIds: string[];
  data: {
    transferId: string;
    type: Transfer['type'];
    fromAccountId: string;
    toAccountId: string | null;
    toExternalAccount: string | null;
    amount: string;
    status: string;
    previousStatus: string | null;
    failureReason: string | null;
    reversalId: string | null;
    reversalStatus: string | null;
  };
}

export interface OutboxEvent {
  id: string;
  eventType: TransferEventType;
  aggregateType: 'TRANSFER';
  aggregateId: string;
  payload: OutboxEnvelope;
  correlationId: string | null;
  attempts: number;
  nextAttemptAt: Date;
  createdAt: Date;
}

export function eventsForNewTransfer(input: {
  transfer: Transfer;
  visibleToUserIds: string[];
  actorUserId: string;
  createdEventId: string;
  statusEventId: string;
}): OutboxEvent[] {
  const created = build(input.transfer, 'transfer.created', input.createdEventId, null, null, input);
  if (input.transfer.status === 'COMPLETED') {
    return [created, build(input.transfer, 'transfer.completed', input.statusEventId, null, null, input)];
  }
  if (input.transfer.status === 'FAILED') {
    return [created, build(input.transfer, 'transfer.failed', input.statusEventId, null, null, input)];
  }
  return [created];
}

export function eventForTransferStatus(input: {
  transfer: Transfer;
  eventId: string;
  previousStatus: TransferStatus;
  visibleToUserIds: string[];
  actorUserId: string | null;
}): OutboxEvent | null {
  const type = eventTypeForStatus(input.transfer.status);
  if (!type || input.transfer.status === input.previousStatus) return null;
  return build(input.transfer, type, input.eventId, input.previousStatus, null, input);
}

export function eventForReversal(input: {
  transfer: Transfer;
  reversal: Reversal;
  eventId: string;
  visibleToUserIds: string[];
  actorUserId: string | null;
  kind: 'requested' | 'reversed' | 'rejected';
}): OutboxEvent {
  const eventType =
    input.kind === 'requested'
      ? 'transfer.reversal_requested'
      : input.kind === 'reversed'
        ? 'transfer.reversed'
        : 'transfer.reversal_rejected';
  const status = input.kind === 'reversed' ? 'REVERSED' : input.transfer.status;
  return build(
    { ...input.transfer, status },
    eventType,
    input.eventId,
    input.transfer.status,
    input.reversal,
    input,
  );
}

function eventTypeForStatus(status: TransferStatus): TransferEventType | null {
  if (status === 'COMPLETED') return 'transfer.completed';
  if (status === 'FAILED') return 'transfer.failed';
  if (status === 'UNKNOWN') return 'transfer.unknown';
  if (status === 'REVERSED') return 'transfer.reversed';
  return null;
}

function build(
  transfer: Transfer,
  eventType: TransferEventType,
  eventId: string,
  previousStatus: string | null,
  reversal: Reversal | null,
  input: { visibleToUserIds: string[]; actorUserId: string | null },
): OutboxEvent {
  const occurredAt = transfer.updatedAt.toISOString();
  const payload: OutboxEnvelope = {
    eventId,
    eventType,
    occurredAt,
    aggregateType: 'TRANSFER',
    aggregateId: transfer.id,
    correlationId: transfer.correlationId,
    actorUserId: input.actorUserId,
    visibleToUserIds: input.visibleToUserIds,
    data: {
      transferId: transfer.id,
      type: transfer.type,
      fromAccountId: transfer.fromAccountId,
      toAccountId: transfer.toAccountId,
      toExternalAccount: transfer.toExternalAccount,
      amount: formatMoney(transfer.amount),
      status: transfer.status,
      previousStatus,
      failureReason: transfer.failureReason,
      reversalId: reversal?.id ?? null,
      reversalStatus: reversal?.status ?? null,
    },
  };
  return {
    id: eventId,
    eventType,
    aggregateType: 'TRANSFER',
    aggregateId: transfer.id,
    payload,
    correlationId: transfer.correlationId,
    attempts: 0,
    nextAttemptAt: transfer.updatedAt,
    createdAt: transfer.updatedAt,
  };
}
