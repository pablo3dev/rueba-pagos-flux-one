// adapter: out — PostgreSQL (transacción del efecto, la idempotencia y el outbox)
import type { Pool, PoolClient } from 'pg';
import type { TransactionScope, UnitOfWork, UnitOfWorkOptions } from '../../../application/ports/unit-of-work.js';
import { PgAccountRepository } from './pg-account-repository.js';
import { PgIdempotencyStore } from './pg-idempotency-store.js';
import { PgOutboxStore } from './pg-outbox-store.js';
import { PgRailWorkRepository } from './pg-rail-work-repository.js';
import { PgReversalRepository, PgReversalWorkRepository } from './pg-reversal-repository.js';
import { PgTransferRepository } from './pg-transfer-repository.js';

export class PgUnitOfWork implements UnitOfWork {
  constructor(private readonly pool: Pool) {}

  async run<T>(work: (scope: TransactionScope) => Promise<T>, options?: UnitOfWorkOptions): Promise<T> {
    const client = await this.pool.connect();
    let released = false;
    const release = (error?: Error): void => {
      if (released) return;
      released = true;
      client.release(error);
    };
    try {
      await client.query('BEGIN');
      if (options?.timeouts !== false) {
        await client.query("SET LOCAL lock_timeout = '5s'");
        await client.query("SET LOCAL statement_timeout = '5s'");
      }
      const result = await work(scopeFor(client));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        release(rollbackError instanceof Error ? rollbackError : new Error('rollback falló'));
        throw error;
      }
      throw error;
    } finally {
      release();
    }
  }
}

function scopeFor(client: PoolClient): TransactionScope {
  return {
    accounts: new PgAccountRepository(client),
    transfers: new PgTransferRepository(client),
    reversals: new PgReversalRepository(client),
    idempotency: new PgIdempotencyStore(client),
    railWork: new PgRailWorkRepository(client),
    reversalWork: new PgReversalWorkRepository(client),
    outbox: new PgOutboxStore(client),
  };
}
