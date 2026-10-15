import type { TransferView } from './types';

export type StatusKind =
  | 'completed'
  | 'reversed'
  | 'confirming'
  | 'failedFunds'
  | 'failedRail'
  | 'failedUnavailable'
  | 'failedOther';

export function transferStatusKind(
  transfer: Pick<TransferView, 'status' | 'failureReason'>,
): StatusKind {
  if (transfer.status === 'PENDING' || transfer.status === 'UNKNOWN') return 'confirming';
  if (transfer.status === 'REVERSED') return 'reversed';
  if (transfer.status === 'COMPLETED') return 'completed';
  if (transfer.failureReason === 'INSUFFICIENT_FUNDS') return 'failedFunds';
  if (transfer.failureReason === 'RAIL_REJECTED') return 'failedRail';
  if (transfer.failureReason === 'RAIL_UNAVAILABLE') return 'failedUnavailable';
  return 'failedOther';
}

export function needsLiveStatus(transfer: TransferView): boolean {
  if (transfer.status === 'PENDING' || transfer.status === 'UNKNOWN') return true;
  const reversal = transfer.reversal?.status;
  return reversal === 'PENDING' || reversal === 'UNKNOWN';
}

export function canReverse(transfer: TransferView): boolean {
  if (transfer.status !== 'COMPLETED') return false;
  const reversal = transfer.reversal;
  return !reversal || reversal.status === 'REJECTED';
}

export function transferDirection(
  fromAccountId: string,
  ownAccountIds: ReadonlySet<string>,
): 'sent' | 'received' {
  return ownAccountIds.has(fromAccountId) ? 'sent' : 'received';
}
