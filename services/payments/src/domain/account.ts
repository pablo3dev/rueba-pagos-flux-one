import { InsufficientFundsError } from './errors.js';
import type { Money } from './money.js';

export interface Account {
  id: string;
  ownerUserId: string;
  currency: 'COP';
  balance: Money;
  createdAt: Date;
  updatedAt: Date;
}

export function debit(account: Account, amount: Money, now: Date): Account {
  if (account.balance < amount) throw new InsufficientFundsError();
  return { ...account, balance: account.balance - amount, updatedAt: now };
}

export function credit(account: Account, amount: Money, now: Date): Account {
  return { ...account, balance: account.balance + amount, updatedAt: now };
}
