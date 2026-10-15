// Raíz de composición: adaptadores, broker y app HTTP.
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { startAuditBroker } from './adapters/inbound/amqp/rabbit-audit-broker.js';
import type { AuditBroker } from './adapters/inbound/amqp/rabbit-audit-broker.js';
import { buildApp } from './adapters/inbound/http/app.js';
import { JwksAccessTokenVerifier } from './adapters/outbound/jose/jwks-access-token-verifier.js';
import { PgAuditEntryRepository } from './adapters/outbound/postgres/pg-audit-entry-repository.js';
import type { Config } from './config.js';

export interface ComposeOptions {
  config: Config;
  pool: Pool;
  logStream?: { write(message: string): void };
}

export interface ComposedApp {
  app: FastifyInstance;
  broker: AuditBroker;
}

export async function composeApp(options: ComposeOptions): Promise<ComposedApp> {
  const { config, pool, logStream } = options;
  const repository = new PgAuditEntryRepository(pool);
  const verifier = new JwksAccessTokenVerifier({
    jwksUrl: config.authJwksUrl,
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
  });

  const isDatabaseReady = async (): Promise<boolean> => {
    try {
      await pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  };

  const runtime: { broker?: AuditBroker } = {};
  const app = await buildApp({
    config,
    repository,
    verifier,
    logStream,
    isReady: async () => (await isDatabaseReady()) && (runtime.broker?.isReady() ?? false),
  });
  const broker = startAuditBroker({
    url: config.amqpUrl,
    repository,
    log: app.log,
  });
  runtime.broker = broker;

  return { app, broker };
}
