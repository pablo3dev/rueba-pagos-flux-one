// adapter: in — @fastify/cookie (cookie firmada `refresh_token`)
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from '../../../config.js';
import { REFRESH_TOKEN_TTL_SECONDS } from '../../../domain/refresh-token.js';

const COOKIE_NAME = 'refresh_token';
const COOKIE_PATH = '/api/auth'; // prefijo con el que el proxy inverso expone el servicio

function attributes(config: Pick<Config, 'cookieSecure'>) {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.cookieSecure,
    path: COOKIE_PATH,
  } as const;
}

export function setRefreshCookie(
  reply: FastifyReply,
  token: string,
  config: Pick<Config, 'cookieSecure'>,
): void {
  reply.setCookie(COOKIE_NAME, token, {
    ...attributes(config),
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
    signed: true,
  });
}

// Cookie ausente, firma inválida o valor vacío equivale a "sin token".
export function readRefreshCookie(request: FastifyRequest): string | undefined {
  const raw = request.cookies[COOKIE_NAME];
  if (raw === undefined) return undefined;
  const { valid, value } = request.unsignCookie(raw);
  return valid && value !== null && value !== '' ? value : undefined;
}

export function clearRefreshCookie(
  reply: FastifyReply,
  config: Pick<Config, 'cookieSecure'>,
): void {
  reply.clearCookie(COOKIE_NAME, attributes(config));
}
