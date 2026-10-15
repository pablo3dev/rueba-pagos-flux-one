// adapter: in — traducción de errores a HTTP
import type { FastifyError, FastifyInstance } from 'fastify';
import {
  LedgerUnavailableError,
  ReferenceConflictError,
  ValidationError,
} from '../../../domain/errors.js';

const VALIDATION_MESSAGE_PREFIX = 'Solicitud inválida: ';

export function errorBody(
  code: string,
  message: string,
): { error: { code: string; message: string } } {
  return { error: { code, message } };
}

export function registerErrorHandlers(app: FastifyInstance): void {
  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send(errorBody('NOT_FOUND', 'Recurso no encontrado.'));
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    const mapped = mapError(error);
    if (mapped.statusCode === 500) {
      request.log.error({ err: error }, 'rail.internal_error');
    }
    return reply.code(mapped.statusCode).send(errorBody(mapped.code, mapped.message));
  });
}

function mapError(error: FastifyError): { statusCode: number; code: string; message: string } {
  if (error instanceof ValidationError) {
    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: `${VALIDATION_MESSAGE_PREFIX}${error.message}`,
    };
  }
  if (error.validation !== undefined) {
    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: `${VALIDATION_MESSAGE_PREFIX}${schemaViolation(error)}`,
    };
  }
  if (error instanceof ReferenceConflictError) {
    return {
      statusCode: 409,
      code: 'REFERENCE_CONFLICT',
      message: 'La referencia ya existe con datos distintos.',
    };
  }
  if (error instanceof LedgerUnavailableError) {
    return {
      statusCode: 503,
      code: 'UNAVAILABLE',
      message: 'El banco no está disponible. Reintenta más tarde.',
    };
  }
  const statusCode = error.statusCode;
  if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: `${VALIDATION_MESSAGE_PREFIX}el cuerpo de la solicitud es inválido.`,
    };
  }
  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: 'Error interno del servidor.',
  };
}

function schemaViolation(error: FastifyError): string {
  const first = error.validation?.[0];
  if (first === undefined) {
    return 'el cuerpo de la solicitud es inválido.';
  }
  const params = first.params;
  let field = first.instancePath.replace(/^\//, '').replaceAll('/', '.');
  if (field.length === 0 && typeof params === 'object') {
    if (typeof params.missingProperty === 'string') {
      field = params.missingProperty;
    } else if (typeof params.additionalProperty === 'string') {
      field = params.additionalProperty;
    }
  }
  if (field.length === 0) {
    field = 'cuerpo';
  }
  return `campo "${field}" no cumple el esquema (${first.keyword})`;
}
