// adapter: in — Fastify (salud)
import type { FastifyInstance } from 'fastify';

export function registerHealthRoutes(
  app: FastifyInstance,
  isDatabaseReady: () => Promise<boolean>,
): void {
  app.get('/health/live', async () => ({ status: 'ok' }));
  app.get('/health/ready', async (_request, reply) => {
    const ready = await isDatabaseReady();
    if (!ready) return reply.code(503).send({ status: 'unavailable' });
    return { status: 'ok' };
  });
}
