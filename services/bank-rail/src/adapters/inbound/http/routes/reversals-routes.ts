// adapter: in — reversos HTTP
import type { FastifyInstance } from 'fastify';
import type { SubmitReversal } from '../../../../application/use-cases/submit-reversal.js';
import { createOperationObserver, presentPost } from '../operation-presenter.js';
import { reversalBodySchema } from '../schemas.js';

export function registerReversalRoutes(
  app: FastifyInstance,
  useCases: { submitReversal: SubmitReversal },
): void {
  // Idempotente por reference del cuerpo: la repetición la resuelve SubmitReversal.
  app.post('/rail/reversals', { schema: { body: reversalBodySchema } }, async (request, reply) => {
    const response = await useCases.submitReversal.execute(
      request.body,
      createOperationObserver(request.log),
    );
    return presentPost(reply, response);
  });
}
