// adapter: in — @fastify/rate-limit (límite por IP en memoria; configuración por ruta)
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import { RateLimitedError } from './error-handler.js';

// Se asignan a `config.rateLimit` de cada ruta; los contadores de login y registro son independientes.
export const LOGIN_RATE_LIMIT = { max: 5, timeWindow: '1 minute' } as const;
export const REGISTER_RATE_LIMIT = { max: 10, timeWindow: '1 minute' } as const;

export async function registerRateLimit(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, {
    global: false,
    // Detrás del proxy inverso la IP real llega en `x-real-ip`; sin ella se usa la IP del socket.
    keyGenerator: (request) => {
      const realIp = request.headers['x-real-ip'];
      return typeof realIp === 'string' && realIp !== '' ? realIp : request.ip;
    },
    // La librería lanza este resultado; `registerErrorHandlers` lo traduce a 429 RATE_LIMITED.
    errorResponseBuilder: () => new RateLimitedError('rate limited'),
  });
}
