// adapter: in — Fastify (instancia, plugins, manejo de errores y rutas)
import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import type { Config } from '../../../config.js';
import type { GetJwks } from '../../../application/use-cases/get-jwks.js';
import type { GetProfile } from '../../../application/use-cases/get-profile.js';
import type { LoginUser } from '../../../application/use-cases/login-user.js';
import type { LogoutSession } from '../../../application/use-cases/logout-session.js';
import type { RefreshSession } from '../../../application/use-cases/refresh-session.js';
import type { RegisterUser } from '../../../application/use-cases/register-user.js';
import { registerErrorHandlers } from './error-handler.js';
import { registerRateLimit } from './rate-limit.js';
import { authRoutes } from './routes/auth-routes.js';
import { healthRoutes } from './routes/health-routes.js';
import { jwksRoutes } from './routes/jwks-routes.js';

export interface UseCases {
  registerUser: RegisterUser;
  loginUser: LoginUser;
  refreshSession: RefreshSession;
  logoutSession: LogoutSession;
  getProfile: GetProfile;
  getJwks: GetJwks;
}

export interface BuildAppDeps {
  config: Config;
  useCases: UseCases;
  isDatabaseReady: () => Promise<boolean>;
  logStream?: { write(message: string): void }; // solo para que las pruebas capturen logs
}

export async function buildApp(deps: BuildAppDeps): Promise<FastifyInstance> {
  const { config, useCases, isDatabaseReady, logStream } = deps;

  const app = Fastify({
    // Por defecto Ajv de Fastify elimina campos extra y convierte tipos; aquí se rechazan (400).
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false } },
    logger: {
      level: config.logLevel,
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      ...(logStream === undefined ? {} : { stream: logStream }),
    },
    requestIdHeader: 'x-request-id',
    genReqId: (req) =>
      typeof req.headers['x-request-id'] === 'string' && req.headers['x-request-id'] !== ''
        ? req.headers['x-request-id']
        : randomUUID(),
  });

  await app.register(cookie, { secret: config.cookieSecret });
  await registerRateLimit(app);
  registerErrorHandlers(app);

  await app.register(authRoutes, {
    config,
    registerUser: useCases.registerUser,
    loginUser: useCases.loginUser,
    refreshSession: useCases.refreshSession,
    logoutSession: useCases.logoutSession,
    getProfile: useCases.getProfile,
  });
  await app.register(jwksRoutes, { getJwks: useCases.getJwks });
  await app.register(healthRoutes, { isDatabaseReady });

  return app;
}
