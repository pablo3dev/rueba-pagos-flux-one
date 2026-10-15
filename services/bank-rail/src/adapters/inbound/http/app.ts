// adapter: in — Fastify
import { randomUUID } from 'node:crypto';
import type { Writable } from 'node:stream';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import type { GetOperation } from '../../../application/use-cases/get-operation.js';
import type { SubmitReversal } from '../../../application/use-cases/submit-reversal.js';
import type { SubmitTransfer } from '../../../application/use-cases/submit-transfer.js';
import type { Config } from '../../../config.js';
import { registerErrorHandlers } from './error-handler.js';
import { registerHealthRoutes } from './routes/health-routes.js';
import { registerReversalRoutes } from './routes/reversals-routes.js';
import { registerTransferRoutes } from './routes/transfers-routes.js';

export interface RailUseCases {
  submitTransfer: SubmitTransfer;
  submitReversal: SubmitReversal;
  getOperation: GetOperation;
}

export function buildApp(deps: {
  config: Config;
  useCases: RailUseCases;
  logStream?: Writable;
}): FastifyInstance {
  const logger: {
    level: string;
    redact: string[];
    stream?: Writable;
  } = {
    level: deps.config.logLevel,
    redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
  };
  if (deps.logStream !== undefined) {
    logger.stream = deps.logStream;
  }

  const app = Fastify({
    logger: logger as NonNullable<FastifyServerOptions['logger']>,
    disableRequestLogging: true,
    requestIdHeader: 'x-request-id',
    genReqId: (req) =>
      typeof req.headers['x-request-id'] === 'string' && req.headers['x-request-id']
        ? req.headers['x-request-id']
        : randomUUID(),
    ajv: {
      customOptions: {
        removeAdditional: false,
        coerceTypes: false,
        useDefaults: false,
      },
    },
  });

  app.addHook('onRequest', async (request) => {
    request.log.info(
      { event: 'rail.request', method: request.method, url: request.url },
      'rail.request',
    );
  });

  app.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        event: 'rail.response',
        statusCode: reply.statusCode,
        responseTimeMs: reply.elapsedTime,
      },
      'rail.response',
    );
  });

  registerErrorHandlers(app);
  registerHealthRoutes(app);
  registerTransferRoutes(app, deps.useCases);
  registerReversalRoutes(app, deps.useCases);
  return app;
}
