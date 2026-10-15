// adapter: in — Fastify (Bearer JWT)
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { TokenVerifier } from '../../../application/ports/token-verifier.js';
import { AccessTokenInvalidError } from '../../../domain/errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

export function authenticate(verifier: TokenVerifier) {
  return async function authHook(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const header = request.headers.authorization;
    const match = typeof header === 'string' ? /^Bearer (\S+)$/.exec(header) : null;
    if (!match?.[1]) {
      request.log.warn({ event: 'auth.token_rejected', code: 'MISSING' }, 'token rechazado');
      throw new AccessTokenInvalidError();
    }
    try {
      const verified = await verifier.verify(match[1]);
      request.userId = verified.userId;
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String(error.code) : 'INVALID';
      request.log.warn({ event: 'auth.token_rejected', code }, 'token rechazado');
      throw new AccessTokenInvalidError();
    }
  };
}
