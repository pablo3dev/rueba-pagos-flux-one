// adapter: out — PostgreSQL (cuentas en payment_schema)
import { formatMoney, moneyFromDb, type Money } from '../../../domain/money.js';
import type { Account } from '../../../domain/account.js';
import type { AccountRepository } from '../../../application/ports/account-repository.js';
import type { Queryable } from './queryable.js';

interface AccountRow {
  id: string;
  owner_user_id: string;
  currency: string;
  balance: string;
  created_at: Date;
  updated_at: Date;
}

const SELECT_ACCOUNT = `SELECT id, owner_user_id, currency, balance::text AS balance, created_at, updated_at
  FROM payment_schema.accounts`;

export class PgAccountRepository implements AccountRepository {
  constructor(private readonly db: Queryable) {}

  async findByOwner(userId: string): Promise<Account[]> {
    const result = await this.db.query<AccountRow>(
      `${SELECT_ACCOUNT} WHERE owner_user_id = $1 ORDER BY id`,
      [userId],
    );
    return result.rows.map(mapAccount);
  }

  async findOwned(id: string, userId: string): Promise<Account | null> {
    const result = await this.db.query<AccountRow>(
      `${SELECT_ACCOUNT} WHERE id = $1 AND owner_user_id = $2`,
      [id, userId],
    );
    const row = result.rows[0];
    return row ? mapAccount(row) : null;
  }

  async lockByIds(ids: string[]): Promise<Account[]> {
    const ordered = [...new Set(ids)].sort();
    const locked: Account[] = [];
    for (const id of ordered) {
      const result = await this.db.query<AccountRow>(`${SELECT_ACCOUNT} WHERE id = $1 FOR UPDATE`, [id]);
      const row = result.rows[0];
      if (row) locked.push(mapAccount(row));
    }
    return locked;
  }

  async debit(id: string, amount: Money, now: Date): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE payment_schema.accounts
       SET balance = balance - $2::numeric, updated_at = $3
       WHERE id = $1 AND balance >= $2::numeric`,
      [id, formatMoney(amount), now],
    );
    return result.rowCount === 1;
  }

  async credit(id: string, amount: Money, now: Date): Promise<void> {
    await this.db.query(
      `UPDATE payment_schema.accounts
       SET balance = balance + $2::numeric, updated_at = $3
       WHERE id = $1`,
      [id, formatMoney(amount), now],
    );
  }
}

function mapAccount(row: AccountRow): Account {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    currency: 'COP',
    balance: moneyFromDb(row.balance),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
