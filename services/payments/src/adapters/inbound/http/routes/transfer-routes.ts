// adapter: in — Fastify (transferencias y reversos)
// Idempotencia: Idempotency-Key en POST /transfers y POST /transfers/:id/reversals.
import type { FastifyInstance } from 'fastify';
import { parseIdempotencyKey } from '../../../../domain/idempotency.js';
import type { CreateReversal } from '../../../../application/use-cases/create-reversal.js';
import type { CreateTransfer, CreateTransferBody } from '../../../../application/use-cases/create-transfer.js';
import type { GetTransfer } from '../../../../application/use-cases/get-transfer.js';
import type { ListTransfers } from '../../../../application/use-cases/list-transfers.js';
import {
  createTransferBodySchema,
  emptyBodySchema,
  errorSchema,
  reversalViewSchema,
  transferDetailSchema,
  transferViewSchema,
} from '../schemas.js';

export function registerTransferRoutes(
  app: FastifyInstance,
  useCases: {
    createTransfer: CreateTransfer;
    getTransfer: GetTransfer;
    listTransfers: ListTransfers;
    createReversal: CreateReversal;
  },
): void {
  app.post(
    '/transfers',
    {
      schema: {
        body: createTransferBodySchema,
        response: {
          201: transferViewSchema,
          202: transferViewSchema,
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
          409: errorSchema,
          422: errorSchema,
        },
      },
      preValidation: async (request) => {
        parseIdempotencyKey(request.headers['idempotency-key']);
      },
    },
    async (request, reply) => {
      const result = await useCases.createTransfer.execute({
        userId: request.userId,
        idempotencyKey: headerKey(request.headers['idempotency-key']),
        body: request.body as CreateTransferBody,
        correlationId: request.id,
      });
      if (result.replayed) reply.header('Idempotent-Replayed', 'true');
      if (result.replayed) request.log.info({ event: 'idempotency.replayed', userId: request.userId }, 'repetición');
      else {
        request.log.info(
          { event: 'transfer.created', transferId: result.transfer.id, status: result.transfer.status, userId: request.userId },
          'transferencia creada',
        );
      }
      return reply.code(result.status).send(result.transfer);
    },
  );

  app.get(
    '/transfers',
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            limit: { type: 'string', pattern: '^[0-9]+$' },
            cursor: { type: 'string', minLength: 1, maxLength: 512 },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['items', 'nextCursor'],
            properties: {
              items: { type: 'array', items: transferViewSchema },
              nextCursor: { type: ['string', 'null'] },
            },
          },
          400: errorSchema,
          401: errorSchema,
        },
      },
    },
    async (request) => {
      const query = request.query as { limit?: string; cursor?: string };
      return useCases.listTransfers.execute({ userId: request.userId, limit: query.limit, cursor: query.cursor });
    },
  );

  app.get(
    '/transfers/:id',
    {
      schema: {
        params: idParams,
        response: { 200: transferDetailSchema, 401: errorSchema, 404: errorSchema },
      },
    },
    async (request) =>
      useCases.getTransfer.execute({
        userId: request.userId,
        transferId: (request.params as { id: string }).id,
      }),
  );

  app.post(
    '/transfers/:id/reversals',
    {
      schema: {
        params: idParams,
        body: emptyBodySchema,
        response: {
          201: reversalViewSchema,
          202: reversalViewSchema,
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
          409: errorSchema,
          422: errorSchema,
        },
      },
      preValidation: async (request) => {
        parseIdempotencyKey(request.headers['idempotency-key']);
      },
    },
    async (request, reply) => {
      const result = await useCases.createReversal.execute({
        userId: request.userId,
        transferId: (request.params as { id: string }).id,
        idempotencyKey: headerKey(request.headers['idempotency-key']),
        body: {},
        correlationId: request.id,
      });
      if (result.replayed) {
        reply.header('Idempotent-Replayed', 'true');
        request.log.info({ event: 'idempotency.replayed', userId: request.userId }, 'repetición');
      }
      return reply.code(result.status).send(result.reversal);
    },
  );
}

const idParams = {
  type: 'object',
  required: ['id'],
  additionalProperties: false,
  properties: { id: { type: 'string', minLength: 1, maxLength: 64 } },
} as const;

function headerKey(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}
