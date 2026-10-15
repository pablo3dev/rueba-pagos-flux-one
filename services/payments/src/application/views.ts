import { formatMoney } from '../domain/money.js';
import type { Account } from '../domain/account.js';
import type { Reversal } from '../domain/reversal.js';
import type { Transfer } from '../domain/transfer.js';

export interface AccountView {
  id: string;
  currency: 'COP';
  balance: string;
}

export interface BalanceView {
  accountId: string;
  currency: 'COP';
  balance: string;
}

export interface TransferView {
  id: string;
  type: 'INTERNAL' | 'EXTERNAL';
  fromAccountId: string;
  toAccountId: string | null;
  toExternalAccount?: string;
  amount: string;
  currency: 'COP';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'UNKNOWN' | 'REVERSED';
  failureReason?: 'INSUFFICIENT_FUNDS' | 'RAIL_REJECTED' | 'RAIL_UNAVAILABLE';
  createdAt: string;
  completedAt: string | null;
}

export interface ReversalView {
  id: string;
  transferId: string;
  amount: string;
  status: 'PENDING' | 'COMPLETED' | 'REJECTED' | 'UNKNOWN';
  rejectionReason?: 'RAIL_REJECTED' | 'RAIL_UNAVAILABLE';
  createdAt: string;
  completedAt: string | null;
}

export interface TransferDetailView extends TransferView {
  reversal: ReversalView | null;
}

export interface TransferPage {
  items: TransferView[];
  nextCursor: string | null;
}

export function toAccountView(account: Account): AccountView {
  return { id: account.id, currency: 'COP', balance: formatMoney(account.balance) };
}

export function toBalanceView(account: Account): BalanceView {
  return { accountId: account.id, currency: 'COP', balance: formatMoney(account.balance) };
}

export function toTransferView(transfer: Transfer): TransferView {
  const view: TransferView = {
    id: transfer.id,
    type: transfer.type,
    fromAccountId: transfer.fromAccountId,
    toAccountId: transfer.toAccountId,
    amount: formatMoney(transfer.amount),
    currency: 'COP',
    status: transfer.status,
    createdAt: transfer.createdAt.toISOString(),
    completedAt: transfer.completedAt ? transfer.completedAt.toISOString() : null,
  };
  if (transfer.toExternalAccount) view.toExternalAccount = transfer.toExternalAccount;
  if (transfer.failureReason) view.failureReason = transfer.failureReason;
  return view;
}

export function toReversalView(reversal: Reversal): ReversalView {
  const view: ReversalView = {
    id: reversal.id,
    transferId: reversal.transferId,
    amount: formatMoney(reversal.amount),
    status: reversal.status,
    createdAt: reversal.createdAt.toISOString(),
    completedAt: reversal.completedAt ? reversal.completedAt.toISOString() : null,
  };
  if (reversal.rejectionReason) view.rejectionReason = reversal.rejectionReason;
  return view;
}
