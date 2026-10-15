// adapter: in — respuestas HTTP de una operación
import type { FastifyBaseLogger, FastifyReply } from 'fastify';
import type {
  OperationObserver,
  OperationResponse,
} from '../../../application/operation-result.js';
import { rejectionCode, type RejectionReason } from '../../../domain/operation.js';
import { errorBody } from './error-handler.js';

const UNAVAILABLE_MESSAGE = 'El banco no está disponible. Reintenta más tarde.';

const REJECTION_MESSAGES: Record<RejectionReason, string> = {
  REJECTED_BY_BANK: 'El banco rechazó la operación (REJECTED_BY_BANK).',
  ORIGINAL_NOT_FOUND: 'La operación original no existe.',
  ORIGINAL_NOT_ACCEPTED: 'La operación original no fue aceptada o no es una transferencia.',
  AMOUNT_MISMATCH: 'El monto no coincide con el de la operación original.',
  ALREADY_REVERSED: 'La operación original ya fue reversada.',
};

export function createOperationObserver(log: FastifyBaseLogger): OperationObserver {
  return {
    outcomeChosen(event) {
      log.info(
        {
          event: 'rail.outcome_chosen',
          reference: event.reference,
          kind: event.kind,
          outcome: event.outcome,
        },
        'rail.outcome_chosen',
      );
    },
    timeout(event) {
      log.warn(
        {
          event: 'rail.timeout',
          reference: event.reference,
          kind: event.kind,
          processed: event.processed,
          delayMs: event.delayMs,
        },
        'rail.timeout',
      );
    },
  };
}

export function presentPost(reply: FastifyReply, response: OperationResponse): FastifyReply {
  if (response.status === 'ACCEPTED') {
    return reply.code(200).send({ reference: response.reference, status: 'ACCEPTED' });
  }
  if (response.status === 'REJECTED') {
    return reply
      .code(422)
      .send(errorBody(rejectionCode(response.reason), REJECTION_MESSAGES[response.reason]));
  }
  return reply.code(503).send(errorBody('UNAVAILABLE', UNAVAILABLE_MESSAGE));
}

export function presentGet(
  reply: FastifyReply,
  response: OperationResponse | undefined,
): FastifyReply {
  if (response === undefined) {
    return reply.code(404).send(errorBody('NOT_FOUND', 'Recurso no encontrado.'));
  }
  if (response.status === 'ACCEPTED') {
    return reply.code(200).send({ reference: response.reference, status: 'ACCEPTED' });
  }
  if (response.status === 'REJECTED') {
    return reply
      .code(422)
      .send(errorBody('REJECTED', `La operación fue rechazada (${response.reason}).`));
  }
  return reply.code(503).send(errorBody('UNAVAILABLE', UNAVAILABLE_MESSAGE));
}
