// adapter: in — Fastify (GET /health/live y GET /health/ready)
import type { FastifyInstance } from 'fastify';
import { healthResponseSchema } from '../schemas.js';

const schema = { response: { 200: healthResponseSchema, 503: healthResponseSchema } };

// Solo lectura: naturalmente idempotente. `ready` no expone el detalle del fallo de la DB.
export async function healthRoutes(
  app: FastifyInstance,
  deps: { isDatabaseReady: () => Promise<boolean> },
): Promise<void> {
  app.get('/health/live', { schema }, async () => ({ status: 'ok' }));

  app.get('/health/ready', { schema }, async (_request, reply) => {
    if (await deps.isDatabaseReady()) return { status: 'ok' };
    return reply.code(503).send({ status: 'unavailable' });
  });
}
