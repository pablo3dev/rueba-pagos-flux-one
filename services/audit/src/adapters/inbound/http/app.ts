// adapter: in — Fastify (instancia, logs JSON y rutas)
import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { AccessTokenVerifier } from '../../../application/ports/access-token-verifier.js';
import type { AuditEntryRepository } from '../../../application/ports/audit-entry-repository.js';
import type { Config } from '../../../config.js';
import { registerErrorHandlers } from './error-handler.js';
import { auditRoutes } from './routes/audit-routes.js';
import { healthRoutes } from './routes/health-routes.js';

export interface BuildAppDeps {
  config: Config;
  repository: AuditEntryRepository;
  verifier: AccessTokenVerifier;
  isReady: () => Promise<boolean>;
  logStream?: { write(message: string): void };
}

export async function buildApp(deps: BuildAppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false } },
    logger: {
      level: deps.config.logLevel,
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      ...(deps.logStream === undefined ? {} : { stream: deps.logStream }),
    },
    requestIdHeader: 'x-request-id',
    genReqId: (req) =>
      typeof req.headers['x-request-id'] === 'string' && req.headers['x-request-id'] !== ''
        ? req.headers['x-request-id']
        : randomUUID(),
  });

  registerErrorHandlers(app);
  await app.register(healthRoutes, { isReady: deps.isReady });
  await app.register(auditRoutes, { verifier: deps.verifier, repository: deps.repository });
  return app;
}
