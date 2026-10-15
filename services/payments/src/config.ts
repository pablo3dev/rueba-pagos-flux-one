export interface Config {
  port: number;
  databaseUrl: string;
  jwksUrl: string;
  jwtIssuer: string;
  jwtAudience: string;
  logLevel: string;
  railBaseUrl: string;
  rabbitUrl: string;
}

const LOG_LEVELS = new Set(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const port = parsePort(env.PORT ?? '3002');
  const databaseUrl = required(env.DATABASE_URL, 'DATABASE_URL');
  const jwksUrl = absoluteHttpUrl(
    env.JWKS_URL ?? env.AUTH_JWKS_URL ?? 'http://auth:3001/.well-known/jwks.json',
    'JWKS_URL',
  );
  const railBaseUrl = normalizeBase(
    requiredUrl(env.RAIL_URL ?? env.RAIL_BASE_URL, 'RAIL_URL', 'RAIL_BASE_URL'),
  );
  const rabbitUrl = requiredAmqp(env.RABBIT_URL, 'RABBIT_URL');
  const jwtIssuer = nonEmpty(env.JWT_ISSUER ?? 'urn:fluxone:auth', 'JWT_ISSUER');
  const jwtAudience = nonEmpty(env.JWT_AUDIENCE ?? 'urn:fluxone:api', 'JWT_AUDIENCE');
  const logLevel = env.LOG_LEVEL ?? 'info';
  if (!LOG_LEVELS.has(logLevel)) throw new Error('LOG_LEVEL es inválido.');
  return { port, databaseUrl, jwksUrl, jwtIssuer, jwtAudience, logLevel, railBaseUrl, rabbitUrl };
}

function parsePort(raw: string): number {
  if (!/^[0-9]+$/.test(raw)) throw new Error('PORT es inválido: debe ser un entero entre 1 y 65535.');
  const port = Number(raw);
  if (port < 1 || port > 65535) throw new Error('PORT es inválido: debe ser un entero entre 1 y 65535.');
  return port;
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} es obligatoria.`);
  return value;
}

function nonEmpty(value: string, name: string): string {
  if (!value.trim()) throw new Error(`${name} es inválida.`);
  return value;
}

function absoluteHttpUrl(value: string, name: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} es inválida: debe ser una URL absoluta http o https.`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${name} es inválida: debe ser una URL absoluta http o https.`);
  }
  return value;
}

function requiredUrl(value: string | undefined, primary: string, alias: string): string {
  if (!value) {
    throw new Error(`${primary} es obligatoria: debe ser una URL absoluta http o https. También se acepta ${alias}.`);
  }
  return absoluteHttpUrl(value, primary);
}

function normalizeBase(value: string): string {
  return value.replace(/\/+$/, '');
}

function requiredAmqp(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} es obligatoria: debe ser una URL amqp o amqps.`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} es inválida: debe ser una URL amqp o amqps.`);
  }
  if (url.protocol !== 'amqp:' && url.protocol !== 'amqps:') {
    throw new Error(`${name} es inválida: debe ser una URL amqp o amqps.`);
  }
  return value;
}
