import type { Pool } from 'pg';
import { buildApp, type AppDeps } from './adapters/inbound/http/app.js';
import { PollingWorker } from './adapters/inbound/workers/polling-worker.js';
import { JoseTokenVerifier } from './adapters/outbound/jwt/jose-token-verifier.js';
import { PgAccountRepository } from './adapters/outbound/postgres/pg-account-repository.js';
import { PgReversalRepository } from './adapters/outbound/postgres/pg-reversal-repository.js';
import { PgTransferRepository } from './adapters/outbound/postgres/pg-transfer-repository.js';
import { PgUnitOfWork } from './adapters/outbound/postgres/pg-unit-of-work.js';
import { AmqpEventPublisher } from './adapters/outbound/rabbit/amqp-event-publisher.js';
import { HttpBankRail } from './adapters/outbound/rail/http-bank-rail.js';
import { SystemClock } from './adapters/outbound/system/system-clock.js';
import { UuidIdGenerator } from './adapters/outbound/system/uuid-id-generator.js';
import type { Clock } from './application/ports/clock.js';
import type { Logger } from './application/ports/logger.js';
import { CreateReversal } from './application/use-cases/create-reversal.js';
import { CreateTransfer } from './application/use-cases/create-transfer.js';
import { DispatchExternalTransfers } from './application/use-cases/dispatch-external-transfers.js';
import { GetAccountBalance } from './application/use-cases/get-account-balance.js';
import { GetTransfer } from './application/use-cases/get-transfer.js';
import { ListAccounts } from './application/use-cases/list-accounts.js';
import { ListTransfers } from './application/use-cases/list-transfers.js';
import { DispatchReversals, ReconcileReversals } from './application/use-cases/process-reversals.js';
import { ReconcileExternalTransfers } from './application/use-cases/reconcile-external-transfers.js';
import { RelayOutbox } from './application/use-cases/relay-outbox.js';
import type { Config } from './config.js';
import type { FastifyInstance } from 'fastify';

export async function composeApp(input: {
  config: Config;
  pool: Pool;
  logStream?: NodeJS.WritableStream;
  clock?: Clock;
}): Promise<FastifyInstance> {
  const clock = input.clock ?? new SystemClock();
  const ids = new UuidIdGenerator();
  const unitOfWork = new PgUnitOfWork(input.pool);
  const accounts = new PgAccountRepository(input.pool);
  const transfers = new PgTransferRepository(input.pool);
  const reversals = new PgReversalRepository(input.pool);
  const tokenVerifier = new JoseTokenVerifier({
    jwksUrl: input.config.jwksUrl,
    issuer: input.config.jwtIssuer,
    audience: input.config.jwtAudience,
    clock,
  });
  const deps: AppDeps = {
    config: input.config,
    tokenVerifier,
    logStream: input.logStream,
    isDatabaseReady: async () => {
      try {
        await input.pool.query('SELECT 1');
        return true;
      } catch {
        return false;
      }
    },
    useCases: {
      listAccounts: new ListAccounts(accounts),
      getAccountBalance: new GetAccountBalance(accounts),
      createTransfer: new CreateTransfer(unitOfWork, clock, ids),
      getTransfer: new GetTransfer(transfers, reversals),
      listTransfers: new ListTransfers(transfers),
      createReversal: new CreateReversal(unitOfWork, clock, ids),
    },
  };
  return buildApp(deps);
}

export function composeWorkers(input: {
  config: Pick<Config, 'railBaseUrl' | 'rabbitUrl'>;
  pool: Pool;
  logger: Logger;
  clock?: Clock;
  railTimeoutMs?: number;
}): {
  start: () => void;
  stop: () => Promise<void>;
} {
  const clock = input.clock ?? new SystemClock();
  const ids = new UuidIdGenerator();
  const unitOfWork = new PgUnitOfWork(input.pool);
  const bank = new HttpBankRail({
    baseUrl: input.config.railBaseUrl,
    logger: input.logger,
    timeoutMs: input.railTimeoutMs,
  });
  const publisher = new AmqpEventPublisher(input.config.rabbitUrl, input.logger);
  const workers = [
    new PollingWorker({
      name: 'dispatch-transfers',
      logger: input.logger,
      useCase: new DispatchExternalTransfers(unitOfWork, bank, clock, ids, input.logger),
    }),
    new PollingWorker({
      name: 'reconcile-transfers',
      logger: input.logger,
      useCase: new ReconcileExternalTransfers(unitOfWork, bank, clock, ids, input.logger),
    }),
    new PollingWorker({
      name: 'dispatch-reversals',
      logger: input.logger,
      useCase: new DispatchReversals(unitOfWork, bank, clock, ids, input.logger),
    }),
    new PollingWorker({
      name: 'reconcile-reversals',
      logger: input.logger,
      useCase: new ReconcileReversals(unitOfWork, bank, clock, ids, input.logger),
    }),
    new PollingWorker({
      name: 'outbox-relay',
      logger: input.logger,
      useCase: new RelayOutbox(unitOfWork, publisher, clock, input.logger),
    }),
  ];
  return {
    start: () => {
      publisher.start();
      for (const worker of workers) worker.start();
    },
    stop: async () => {
      await Promise.all(workers.map((worker) => worker.stop()));
      await publisher.close();
    },
  };
}
