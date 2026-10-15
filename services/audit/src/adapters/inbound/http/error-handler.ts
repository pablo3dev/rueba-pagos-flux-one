// adapter: in — Fastify (tabla error → status/code con formato {error:{code,message}})
import type { FastifyError, FastifyInstance } from 'fastify';
import { NotFoundError, UnauthorizedError, ValidationError } from '../../../domain/errors.js';

type ErrorCode = 'VALIDATION_ERROR' | 'UNAUTHORIZED' | 'NOT_FOUND' | 'INTERNAL_ERROR';

const ERRORS: Record<ErrorCode, { status: number; message: string }> = {
  VALIDATION_ERROR: { status: 400, message: 'Solicitud inválida' },
  UNAUTHORIZED: { status: 401, message: 'Token de acceso ausente o inválido.' },
  NOT_FOUND: { status: 404, message: 'Recurso no encontrado.' },
  INTERNAL_ERROR: { status: 500, message: 'Error interno del servidor.' },
};

function errorBody(code: ErrorCode): { error: { code: ErrorCode; message: string } } {
  return { error: { code, message: ERRORS[code].message } };
}

function classify(error: FastifyError): ErrorCode {
  if (error.validation) return 'VALIDATION_ERROR';
  if (error instanceof ValidationError) return 'VALIDATION_ERROR';
  if (error instanceof UnauthorizedError) return 'UNAUTHORIZED';
  if (error instanceof NotFoundError) return 'NOT_FOUND';
  if (error.statusCode === 400) return 'VALIDATION_ERROR';
  return 'INTERNAL_ERROR';
}

export function registerErrorHandlers(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const code = classify(error);
    if (code === 'INTERNAL_ERROR') request.log.error({ err: error }, 'unhandled error');
    return reply.code(ERRORS[code].status).send(errorBody(code));
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.code(ERRORS.NOT_FOUND.status).send(errorBody('NOT_FOUND')),
  );
}
