// Raíz de composición: crea adaptadores y casos de uso y construye la app HTTP.
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { buildApp } from './adapters/inbound/http/app.js';
import type { BuildAppDeps } from './adapters/inbound/http/app.js';
import { Argon2PasswordHasher } from './adapters/outbound/crypto/argon2-password-hasher.js';
import { JoseSigningKeyGenerator } from './adapters/outbound/crypto/jose-signing-key-generator.js';
import { JoseTokenIssuer } from './adapters/outbound/crypto/jose-token-issuer.js';
import { NodeOpaqueTokenGenerator } from './adapters/outbound/crypto/node-opaque-token-generator.js';
import { SystemClock } from './adapters/outbound/crypto/system-clock.js';
import { PgRefreshTokenRepository } from './adapters/outbound/postgres/pg-refresh-token-repository.js';
import { PgSigningKeyRepository } from './adapters/outbound/postgres/pg-signing-key-repository.js';
import { PgUserRepository } from './adapters/outbound/postgres/pg-user-repository.js';
import { EnsureSigningKey } from './application/use-cases/ensure-signing-key.js';
import { GetJwks } from './application/use-cases/get-jwks.js';
import { GetProfile } from './application/use-cases/get-profile.js';
import { LoginUser } from './application/use-cases/login-user.js';
import { LogoutSession } from './application/use-cases/logout-session.js';
import { RefreshSession } from './application/use-cases/refresh-session.js';
import { RegisterUser } from './application/use-cases/register-user.js';
import { SeedDemoUsers } from './application/use-cases/seed-demo-users.js';
import type { Config } from './config.js';

export interface ComposeOptions {
  config: Config;
  pool: Pool;
  logStream?: BuildAppDeps['logStream'];
}

export async function composeApp(options: ComposeOptions): Promise<FastifyInstance> {
  const { config, pool, logStream } = options;

  const clock = new SystemClock();
  const hasher = new Argon2PasswordHasher();
  const tokens = new NodeOpaqueTokenGenerator();
  const generator = new JoseSigningKeyGenerator(clock);
  const users = new PgUserRepository(pool);
  const refreshTokens = new PgRefreshTokenRepository(pool);
  const signingKeys = new PgSigningKeyRepository(pool);

  // Idempotentes: la llave de firma y los usuarios demo se crean solo si faltan (reinicios seguros).
  const keys = await new EnsureSigningKey({ signingKeys, generator }).execute();
  await new SeedDemoUsers({ users, hasher, clock }).execute({ password: config.demoUsersPassword });

  const dummyPasswordHash = await hasher.hash(randomUUID());
  const tokenIssuer = new JoseTokenIssuer({
    keys,
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
    clock,
  });

  const isDatabaseReady = async (): Promise<boolean> => {
    try {
      await pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  };

  return buildApp({
    config,
    isDatabaseReady,
    logStream,
    useCases: {
      registerUser: new RegisterUser({ users, hasher, clock }),
      loginUser: new LoginUser({
        users,
        refreshTokens,
        hasher,
        tokenIssuer,
        tokens,
        clock,
        dummyPasswordHash,
      }),
      refreshSession: new RefreshSession({ users, refreshTokens, tokenIssuer, tokens, clock }),
      logoutSession: new LogoutSession({ refreshTokens, tokens, clock }),
      getProfile: new GetProfile({ tokenIssuer }),
      getJwks: new GetJwks({ tokenIssuer }),
    },
  });
}
