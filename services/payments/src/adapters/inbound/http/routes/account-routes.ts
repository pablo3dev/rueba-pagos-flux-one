// adapter: in — Fastify (cuentas)
import type { FastifyInstance } from 'fastify';
import type { GetAccountBalance } from '../../../../application/use-cases/get-account-balance.js';
import type { ListAccounts } from '../../../../application/use-cases/list-accounts.js';
import { errorSchema } from '../schemas.js';

export function registerAccountRoutes(
  app: FastifyInstance,
  useCases: { listAccounts: ListAccounts; getAccountBalance: GetAccountBalance },
): void {
  app.get(
    '/accounts',
    {
      schema: {
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['id', 'currency', 'balance'],
              properties: {
                id: { type: 'string' },
                currency: { type: 'string', const: 'COP' },
                balance: { type: 'string' },
              },
            },
          },
          401: errorSchema,
        },
      },
    },
    async (request) => useCases.listAccounts.execute({ userId: request.userId }),
  );

  app.get(
    '/accounts/:id/balance',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          additionalProperties: false,
          properties: { id: { type: 'string', minLength: 1, maxLength: 64 } },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['accountId', 'currency', 'balance'],
            properties: {
              accountId: { type: 'string' },
              currency: { type: 'string', const: 'COP' },
              balance: { type: 'string' },
            },
          },
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request) =>
      useCases.getAccountBalance.execute({
        userId: request.userId,
        accountId: (request.params as { id: string }).id,
      }),
  );
}
