// adapter: in — Fastify (GET /.well-known/jwks.json)
import type { FastifyInstance } from 'fastify';
import type { GetJwks } from '../../../../application/use-cases/get-jwks.js';
import { jwksResponseSchema } from '../schemas.js';

// Solo lectura: naturalmente idempotente.
export async function jwksRoutes(app: FastifyInstance, deps: { getJwks: GetJwks }): Promise<void> {
  app.get(
    '/.well-known/jwks.json',
    { schema: { response: { 200: jwksResponseSchema } } },
    async () => deps.getJwks.execute(),
  );
}
