// adapter: in — Fastify (rutas /auth/register, /auth/login, /auth/refresh, /auth/logout y /auth/me)
import { createHash } from 'node:crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { GetProfile } from '../../../../application/use-cases/get-profile.js';
import type { LoginUser, SessionResult } from '../../../../application/use-cases/login-user.js';
import type { LogoutSession } from '../../../../application/use-cases/logout-session.js';
import type { RefreshSession } from '../../../../application/use-cases/refresh-session.js';
import type { RegisterUser } from '../../../../application/use-cases/register-user.js';
import {
  AccessTokenInvalidError,
  InvalidCredentialsError,
  RefreshTokenInvalidError,
  RefreshTokenReusedError,
} from '../../../../domain/errors.js';
import type { Config } from '../../../../config.js';
import { LOGIN_RATE_LIMIT, REGISTER_RATE_LIMIT } from '../rate-limit.js';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from '../refresh-cookie.js';
import {
  credentialsBodySchema,
  errorResponseSchema,
  sessionResponseSchema,
  userResponseSchema,
} from '../schemas.js';

interface AuthRoutesDeps {
  config: Pick<Config, 'cookieSecure'>;
  registerUser: RegisterUser;
  loginUser: LoginUser;
  refreshSession: RefreshSession;
  logoutSession: LogoutSession;
  getProfile: GetProfile;
}

interface CredentialsBody {
  email: string;
  password: string;
}

// SHA-256 hex del email normalizado: identifica el intento fallido sin registrar el email en claro.
function hashEmail(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

const BEARER_HEADER = /^Bearer\s+(\S+)$/i;

// Extrae el access token de `Authorization: Bearer <jwt>`; cualquier otra forma es no autorizado.
function readBearerToken(authorization: string | undefined): string {
  const token = authorization === undefined ? undefined : BEARER_HEADER.exec(authorization)?.[1];
  if (token === undefined) throw new AccessTokenInvalidError();
  return token;
}

// El refresh token viaja solo en la cookie: nunca en el cuerpo.
function sendSession(
  reply: FastifyReply,
  session: SessionResult,
  config: AuthRoutesDeps['config'],
) {
  setRefreshCookie(reply, session.refreshToken, config);
  const { accessToken, tokenType, expiresIn, user } = session;
  return reply.code(200).send({ accessToken, tokenType, expiresIn, user });
}

export async function authRoutes(app: FastifyInstance, deps: AuthRoutesDeps): Promise<void> {
  const { config, registerUser, loginUser, refreshSession, logoutSession, getProfile } = deps;

  // Idempotencia: la unicidad del email garantiza un solo alta; la repetición responde 409.
  app.post<{ Body: CredentialsBody }>(
    '/auth/register',
    {
      config: { rateLimit: REGISTER_RATE_LIMIT },
      schema: {
        body: credentialsBodySchema,
        response: { 201: userResponseSchema, '4xx': errorResponseSchema },
      },
    },
    async (request, reply) => {
      const user = await registerUser.execute(request.body);
      return reply.code(201).send(user);
    },
  );

  // Idempotencia: no aplica; cada login crea una sesión nueva (efecto aditivo por diseño).
  app.post<{ Body: CredentialsBody }>(
    '/auth/login',
    {
      config: { rateLimit: LOGIN_RATE_LIMIT },
      schema: {
        body: credentialsBodySchema,
        response: { 200: sessionResponseSchema, '4xx': errorResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const session = await loginUser.execute(request.body);
        request.log.info({ event: 'auth.login_succeeded', userId: session.user.id });
        return sendSession(reply, session, config);
      } catch (error) {
        if (error instanceof InvalidCredentialsError) {
          request.log.info({
            event: 'auth.login_failed',
            emailHash: hashEmail(request.body.email),
          });
        }
        throw error;
      }
    },
  );

  // Idempotencia: un solo uso del token; repetirlo con el mismo valor no repite el efecto,
  // revoca la familia y responde REUSED (rotación atómica en el repositorio).
  app.post(
    '/auth/refresh',
    { schema: { response: { 200: sessionResponseSchema, '4xx': errorResponseSchema } } },
    async (request, reply) => {
      try {
        const refreshToken = readRefreshCookie(request);
        if (refreshToken === undefined) throw new RefreshTokenInvalidError();
        const session = await refreshSession.execute({ refreshToken });
        return sendSession(reply, session, config);
      } catch (error) {
        if (error instanceof RefreshTokenReusedError) {
          request.log.warn({
            event: 'auth.refresh_reuse_detected',
            userId: error.userId,
            familyId: error.familyId,
          });
        }
        if (error instanceof RefreshTokenInvalidError || error instanceof RefreshTokenReusedError) {
          clearRefreshCookie(reply, config);
        }
        throw error;
      }
    },
  );

  // Idempotente: revocar lo ya revocado, o un token desconocido o ausente, no cambia nada.
  app.post('/auth/logout', async (request, reply) => {
    await logoutSession.execute({ refreshToken: readRefreshCookie(request) });
    clearRefreshCookie(reply, config);
    return reply.code(204).send();
  });

  // Solo lectura (naturalmente idempotente).
  app.get(
    '/auth/me',
    { schema: { response: { 200: userResponseSchema, '4xx': errorResponseSchema } } },
    async (request) => {
      const accessToken = readBearerToken(request.headers.authorization);
      return getProfile.execute({ accessToken });
    },
  );
}
