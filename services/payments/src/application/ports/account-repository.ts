// port: out — cuentas que el caso de uso necesita
import type { Account } from '../../domain/account.js';
import type { Money } from '../../domain/money.js';

export interface AccountRepository {
  findByOwner(userId: string): Promise<Account[]>;
  findOwned(id: string, userId: string): Promise<Account | null>;
  lockByIds(ids: string[]): Promise<Account[]>;
  debit(id: string, amount: Money, now: Date): Promise<boolean>;
  credit(id: string, amount: Money, now: Date): Promise<void>;
}
