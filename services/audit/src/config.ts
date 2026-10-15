export interface Config {
  port: number;
  databaseUrl: string;
  amqpUrl: string;
  authJwksUrl: string;
  jwtIssuer: string;
  jwtAudience: string;
  logLevel: string;
}

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];

function fail(variable: string, rule: string): never {
  throw new Error(`Configuración inválida: ${variable} ${rule}.`);
}

function required(env: NodeJS.ProcessEnv, variable: string): string {
  const value = env[variable];
  if (value === undefined || value === '') fail(variable, 'es obligatoria');
  return value;
}

function optional(env: NodeJS.ProcessEnv, variable: string, fallback: string): string {
  const value = env[variable];
  return value === undefined || value === '' ? fallback : value;
}

function parsePort(raw: string): number {
  const port = /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    fail('PORT', 'debe ser un entero entre 1 y 65535');
  }
  return port;
}

function parseHttpUrl(variable: string, raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    fail(variable, 'debe ser una URL absoluta');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    fail(variable, 'debe usar http o https');
  }
  return raw;
}

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const logLevel = optional(env, 'LOG_LEVEL', 'info');
  if (!LOG_LEVELS.includes(logLevel)) {
    fail('LOG_LEVEL', `debe ser uno de: ${LOG_LEVELS.join(', ')}`);
  }

  const amqpUrl = required(env, 'AMQP_URL');
  let amqp: URL;
  try {
    amqp = new URL(amqpUrl);
  } catch {
    fail('AMQP_URL', 'debe ser una URL amqp absoluta');
  }
  if (amqp.protocol !== 'amqp:' && amqp.protocol !== 'amqps:') {
    fail('AMQP_URL', 'debe usar amqp o amqps');
  }

  return {
    port: parsePort(optional(env, 'PORT', '3003')),
    databaseUrl: required(env, 'DATABASE_URL'),
    amqpUrl,
    authJwksUrl: parseHttpUrl('AUTH_JWKS_URL', required(env, 'AUTH_JWKS_URL')),
    jwtIssuer: optional(env, 'JWT_ISSUER', 'urn:fluxone:auth'),
    jwtAudience: optional(env, 'JWT_AUDIENCE', 'urn:fluxone:api'),
    logLevel,
  };
}
