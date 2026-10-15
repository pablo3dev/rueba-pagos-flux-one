import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { composeApp } from '../../src/compose.js';
import { loadConfig } from '../../src/config.js';
import type { Config } from '../../src/config.js';

// Variables de entorno de prueba: DATABASE_URL la aporta Compose; el resto son valores desechables.
export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    ...loadConfig({
      DATABASE_URL: process.env.DATABASE_URL,
      COOKIE_SECRET: 'test_cookie_secret_0123456789abcdef0123456789',
      COOKIE_SECURE: 'false',
      DEMO_USERS_PASSWORD: 'demo_password_123',
      LOG_LEVEL: 'silent',
    }),
    ...overrides,
  };
}

// Compone la app real (adaptadores Postgres y crypto reales) sobre el pool recibido.
export function buildTestApp(
  pool: pg.Pool,
  options: { config?: Partial<Config>; logStream?: { write(message: string): void } } = {},
): Promise<FastifyInstance> {
  return composeApp({ config: testConfig(options.config), pool, logStream: options.logStream });
}
