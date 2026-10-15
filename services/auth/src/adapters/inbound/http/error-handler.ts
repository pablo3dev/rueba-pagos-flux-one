// adapter: in — Fastify (tabla error → status/code con formato {error:{code,message}})
import type { FastifyError, FastifyInstance } from 'fastify';
import {
  AccessTokenInvalidError,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  RefreshTokenInvalidError,
  RefreshTokenReusedError,
  ValidationError,
} from '../../../domain/errors.js';

type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'EMAIL_TAKEN'
  | 'INVALID_CREDENTIALS'
  | 'RATE_LIMITED'
  | 'REFRESH_TOKEN_INVALID'
  | 'REFRESH_TOKEN_REUSED'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR';

const ERRORS: Record<ErrorCode, { status: number; message: string }> = {
  VALIDATION_ERROR: { status: 400, message: 'Solicitud inválida' },
  EMAIL_TAKEN: { status: 409, message: 'El correo ya está registrado.' },
  INVALID_CREDENTIALS: { status: 401, message: 'Correo o contraseña incorrectos.' },
  RATE_LIMITED: { status: 429, message: 'Demasiados intentos. Intenta de nuevo en un minuto.' },
  REFRESH_TOKEN_INVALID: { status: 401, message: 'La sesión no es válida o expiró.' },
  REFRESH_TOKEN_REUSED: {
    status: 401,
    message: 'La sesión fue revocada por seguridad. Inicia sesión de nuevo.',
  },
  UNAUTHORIZED: { status: 401, message: 'Token de acceso ausente o inválido.' },
  NOT_FOUND: { status: 404, message: 'Recurso no encontrado.' },
  INTERNAL_ERROR: { status: 500, message: 'Error interno del servidor.' },
};

// Lo lanza el errorResponseBuilder de @fastify/rate-limit (la librería hace `throw` de su resultado).
export class RateLimitedError extends Error {
  readonly statusCode = 429;
}

function errorBody(
  code: ErrorCode,
  detail?: string,
): { error: { code: ErrorCode; message: string } } {
  const { message } = ERRORS[code];
  return { error: { code, message: detail === undefined ? message : `${message}: ${detail}` } };
}

function classify(error: FastifyError): { code: ErrorCode; detail?: string } {
  if (error.validation) {
    const first = error.validation[0];
    const where = error.validationContext ?? 'body';
    return {
      code: 'VALIDATION_ERROR',
      detail: first ? `${where}${first.instancePath} ${first.message ?? 'no es válido'}` : where,
    };
  }
  if (error instanceof ValidationError) return { code: 'VALIDATION_ERROR', detail: error.message };
  if (error instanceof EmailAlreadyRegisteredError) return { code: 'EMAIL_TAKEN' };
  if (error instanceof InvalidCredentialsError) return { code: 'INVALID_CREDENTIALS' };
  if (error instanceof RefreshTokenInvalidError) return { code: 'REFRESH_TOKEN_INVALID' };
  if (error instanceof RefreshTokenReusedError) return { code: 'REFRESH_TOKEN_REUSED' };
  if (error instanceof AccessTokenInvalidError) return { code: 'UNAUTHORIZED' };
  if (error instanceof RateLimitedError) return { code: 'RATE_LIMITED' };
  // Cuerpo malformado (JSON inválido, cuerpo vacío): error del cliente que Fastify marca con 400.
  if (error.statusCode === 400) {
    return { code: 'VALIDATION_ERROR', detail: 'cuerpo de la solicitud malformado' };
  }
  return { code: 'INTERNAL_ERROR' };
}

export function registerErrorHandlers(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const { code, detail } = classify(error);
    if (code === 'INTERNAL_ERROR') request.log.error({ err: error }, 'unhandled error');
    return reply.code(ERRORS[code].status).send(errorBody(code, detail));
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.code(ERRORS.NOT_FOUND.status).send(errorBody('NOT_FOUND')),
  );
}
