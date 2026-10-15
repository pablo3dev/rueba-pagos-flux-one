// adapter: in — Fastify (POST /auth/register y POST /auth/login)
import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { LoginUser } from '../../../../application/use-cases/login-user.js';
import type { RegisterUser } from '../../../../application/use-cases/register-user.js';
import { InvalidCredentialsError } from '../../../../domain/errors.js';
import type { Config } from '../../../../config.js';
import { LOGIN_RATE_LIMIT, REGISTER_RATE_LIMIT } from '../rate-limit.js';
import { setRefreshCookie } from '../refresh-cookie.js';
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
}

interface CredentialsBody {
  email: string;
  password: string;
}

// SHA-256 hex del email normalizado: identifica el intento fallido sin registrar el email en claro.
function hashEmail(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

export async function authRoutes(app: FastifyInstance, deps: AuthRoutesDeps): Promise<void> {
  const { config, registerUser, loginUser } = deps;

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
        setRefreshCookie(reply, session.refreshToken, config);
        // El refresh token viaja solo en la cookie: nunca en el cuerpo.
        const { accessToken, tokenType, expiresIn, user } = session;
        return reply.code(200).send({ accessToken, tokenType, expiresIn, user });
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
}
