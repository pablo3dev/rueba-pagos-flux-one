// adapter: in — GET /health
import type { FastifyInstance } from 'fastify';

export function registerHealthRoutes(app: FastifyInstance): void {
  // Lectura pura: no autentica ni lee Authorization.
  app.get('/health', async (_request, reply) => {
    return reply.code(200).send({ status: 'ok' });
  });
}
