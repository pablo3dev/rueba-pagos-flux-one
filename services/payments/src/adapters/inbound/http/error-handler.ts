// adapter: in — Fastify (errores uniformes {error:{code,message}})
import type { FastifyError, FastifyInstance } from 'fastify';
import {
  AccessTokenInvalidError,
  AccountNotFoundError,
  DestinationNotFoundError,
  IdempotencyKeyInProgressError,
  IdempotencyKeyPayloadMismatchError,
  IdempotencyKeyRequiredError,
  InvalidAmountError,
  ReversalInsufficientFundsError,
  SameAccountError,
  TransferAlreadyReversedError,
  TransferNotFoundError,
  TransferNotReversibleError,
  ValidationError,
} from '../../../domain/errors.js';

interface Mapped {
  status: number;
  code: string;
  message: string;
}

const MESSAGES = {
  UNAUTHORIZED: 'Token de acceso ausente o inválido.',
  INVALID_AMOUNT:
    'El monto es inválido: debe ser un texto decimal mayor que 0, con hasta 2 decimales y un máximo de 9999999999999999.99.',
  IDEMPOTENCY_KEY_REQUIRED:
    'El encabezado Idempotency-Key es obligatorio: de 1 a 255 caracteres ASCII imprimibles.',
  ACCOUNT_NOT_FOUND: 'Cuenta no encontrada.',
  DESTINATION_NOT_FOUND: 'Cuenta destino no encontrada.',
  TRANSFER_NOT_FOUND: 'Transferencia no encontrada.',
  NOT_FOUND: 'Recurso no encontrado.',
  SAME_ACCOUNT: 'La cuenta origen y la cuenta destino deben ser distintas.',
  IDEMPOTENCY_KEY_PAYLOAD_MISMATCH: 'La clave de idempotencia ya se usó con una solicitud distinta.',
  IDEMPOTENCY_KEY_IN_PROGRESS:
    'Hay otra solicitud en curso con la misma clave de idempotencia. Intenta de nuevo.',
  TRANSFER_NOT_REVERSIBLE: 'La transferencia no se puede reversar.',
  TRANSFER_ALREADY_REVERSED: 'La transferencia ya fue reversada o tiene un reverso en curso.',
  REVERSAL_INSUFFICIENT_FUNDS: 'La cuenta destino no tiene saldo suficiente para el reverso.',
  INTERNAL_ERROR: 'Error interno del servidor.',
} as const;

export function registerErrorHandlers(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const mapped = classify(error);
    if (mapped.code === 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH') {
      request.log.warn({ event: 'idempotency.mismatch', userId: request.userId }, 'conflicto de idempotencia');
    }
    if (mapped.code === 'INTERNAL_ERROR') request.log.error({ err: error }, 'error no controlado');
    return reply.code(mapped.status).send({ error: { code: mapped.code, message: mapped.message } });
  });
  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: MESSAGES.NOT_FOUND } });
  });
}

function classify(error: FastifyError): Mapped {
  if (error instanceof AccessTokenInvalidError) return http(401, 'UNAUTHORIZED');
  if (error instanceof InvalidAmountError) return http(400, 'INVALID_AMOUNT');
  if (error instanceof IdempotencyKeyRequiredError) return http(400, 'IDEMPOTENCY_KEY_REQUIRED');
  if (error instanceof AccountNotFoundError) return http(404, 'ACCOUNT_NOT_FOUND');
  if (error instanceof DestinationNotFoundError) return http(404, 'DESTINATION_NOT_FOUND');
  if (error instanceof TransferNotFoundError) return http(404, 'TRANSFER_NOT_FOUND');
  if (error instanceof SameAccountError) return http(422, 'SAME_ACCOUNT');
  if (error instanceof IdempotencyKeyPayloadMismatchError) return http(422, 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH');
  if (error instanceof IdempotencyKeyInProgressError) return http(409, 'IDEMPOTENCY_KEY_IN_PROGRESS');
  if (error instanceof TransferNotReversibleError) return http(409, 'TRANSFER_NOT_REVERSIBLE');
  if (error instanceof TransferAlreadyReversedError) return http(409, 'TRANSFER_ALREADY_REVERSED');
  if (error instanceof ReversalInsufficientFundsError) return http(422, 'REVERSAL_INSUFFICIENT_FUNDS');
  if (error instanceof ValidationError || error.validation || isParseError(error)) {
    const detail = error instanceof ValidationError ? error.message : validationDetail(error);
    return { status: 400, code: 'VALIDATION_ERROR', message: `Solicitud inválida: ${detail}` };
  }
  return http(500, 'INTERNAL_ERROR');
}

function http(status: number, code: keyof typeof MESSAGES): Mapped {
  return { status, code, message: MESSAGES[code] };
}

function isParseError(error: FastifyError): boolean {
  return typeof error.code === 'string' && error.code.startsWith('FST_ERR_CTP_');
}

function validationDetail(error: FastifyError): string {
  const first = error.validation?.[0];
  if (!first) return 'solicitud inválida';
  if (first.keyword === 'required') {
    const field = (first.params as { missingProperty?: string }).missingProperty ?? 'desconocido';
    return `falta el campo "${field}"`;
  }
  if (first.keyword === 'additionalProperties') {
    const field = (first.params as { additionalProperty?: string }).additionalProperty ?? 'desconocido';
    return `campo no permitido "${field}"`;
  }
  const path = first.instancePath.replace(/^\//, '').replaceAll('/', '.') || 'solicitud';
  return `valor inválido en "${path}"`;
}
