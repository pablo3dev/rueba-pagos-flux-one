// adapter: in — Fastify
import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import type { TokenVerifier } from '../../../application/ports/token-verifier.js';
import type { CreateReversal } from '../../../application/use-cases/create-reversal.js';
import type { CreateTransfer } from '../../../application/use-cases/create-transfer.js';
import type { GetAccountBalance } from '../../../application/use-cases/get-account-balance.js';
import type { GetTransfer } from '../../../application/use-cases/get-transfer.js';
import type { ListAccounts } from '../../../application/use-cases/list-accounts.js';
import type { ListTransfers } from '../../../application/use-cases/list-transfers.js';
import type { Config } from '../../../config.js';
import { authenticate } from './auth-hook.js';
import { registerErrorHandlers } from './error-handler.js';
import { registerAccountRoutes } from './routes/account-routes.js';
import { registerHealthRoutes } from './routes/health-routes.js';
import { registerTransferRoutes } from './routes/transfer-routes.js';

export interface AppDeps {
  config: Config;
  tokenVerifier: TokenVerifier;
  isDatabaseReady: () => Promise<boolean>;
  logStream?: NodeJS.WritableStream;
  useCases: {
    listAccounts: ListAccounts;
    getAccountBalance: GetAccountBalance;
    createTransfer: CreateTransfer;
    getTransfer: GetTransfer;
    listTransfers: ListTransfers;
    createReversal: CreateReversal;
  };
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({
    logger: {
      level: deps.config.logLevel,
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        'headers.authorization',
        'headers.cookie',
        'headers["set-cookie"]',
      ],
      ...(deps.logStream ? { stream: deps.logStream } : {}),
    },
    requestIdHeader: 'x-request-id',
    genReqId: (req) => {
      const header = req.headers['x-request-id'];
      return typeof header === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(header) ? header : randomUUID();
    },
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false, useDefaults: false } },
  });
  app.addHook('onSend', async (request, reply) => {
    reply.header('X-Request-Id', request.id);
  });
  registerErrorHandlers(app);
  registerHealthRoutes(app, deps.isDatabaseReady);
  app.register(async (scope) => {
    scope.addHook('onRequest', authenticate(deps.tokenVerifier));
    registerAccountRoutes(scope, deps.useCases);
    registerTransferRoutes(scope, deps.useCases);
  });
  return app;
}
