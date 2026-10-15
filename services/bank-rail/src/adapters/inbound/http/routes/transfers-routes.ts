// adapter: in — transferencias HTTP
import type { FastifyInstance } from 'fastify';
import type { GetOperation } from '../../../../application/use-cases/get-operation.js';
import type { SubmitTransfer } from '../../../../application/use-cases/submit-transfer.js';
import { createOperationObserver, presentGet, presentPost } from '../operation-presenter.js';
import { referenceParamSchema, transferBodySchema } from '../schemas.js';

export function registerTransferRoutes(
  app: FastifyInstance,
  useCases: { submitTransfer: SubmitTransfer; getOperation: GetOperation },
): void {
  // Idempotente por reference del cuerpo: la repetición la resuelve SubmitTransfer.
  app.post('/rail/transfers', { schema: { body: transferBodySchema } }, async (request, reply) => {
    const response = await useCases.submitTransfer.execute(
      request.body,
      createOperationObserver(request.log),
    );
    return presentPost(reply, response);
  });

  // Lectura pura: no sortea ni escribe.
  app.get(
    '/rail/transfers/:reference',
    { schema: { params: referenceParamSchema } },
    async (request, reply) => {
      const { reference } = request.params as { reference: string };
      const response = await useCases.getOperation.execute(reference);
      return presentGet(reply, response);
    },
  );
}
