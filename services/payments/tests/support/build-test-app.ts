import type { Pool } from 'pg';
import type { FastifyInstance } from 'fastify';
import { composeApp } from '../../src/compose.js';
import { loadConfig } from '../../src/config.js';

export async function buildTestApp(pool: Pool, jwksUrl: string): Promise<FastifyInstance> {
  const config = loadConfig({
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL,
    JWKS_URL: jwksUrl,
    RAIL_URL: 'http://127.0.0.1:9',
    RABBIT_URL: 'amqp://guest:guest@127.0.0.1:5672/fluxone',
    JWT_ISSUER: 'urn:fluxone:auth',
    JWT_AUDIENCE: 'urn:fluxone:api',
    LOG_LEVEL: 'silent',
  });
  return composeApp({ config, pool });
}
