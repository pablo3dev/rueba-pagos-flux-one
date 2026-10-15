import { ValidationError } from './domain/errors.js';
import { assertValidPassword } from './domain/password-policy.js';

export interface Config {
  port: number;
  databaseUrl: string;
  jwtIssuer: string;
  jwtAudience: string;
  cookieSecret: string;
  cookieSecure: boolean;
  demoUsersPassword: string;
  logLevel: string;
}

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];
const COOKIE_SECRET_MIN_LENGTH = 32;

// Los mensajes nombran la variable y la regla, nunca el valor recibido (pueden ser secretos).
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

function parseCookieSecure(raw: string): boolean {
  if (raw !== 'true' && raw !== 'false') fail('COOKIE_SECURE', 'debe ser "true" o "false"');
  return raw === 'true';
}

function parseDemoUsersPassword(raw: string): string {
  try {
    assertValidPassword(raw);
  } catch (error) {
    if (error instanceof ValidationError) {
      fail('DEMO_USERS_PASSWORD', 'debe tener entre 12 y 128 caracteres');
    }
    throw error;
  }
  return raw;
}

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const cookieSecret = required(env, 'COOKIE_SECRET');
  if (cookieSecret.length < COOKIE_SECRET_MIN_LENGTH) {
    fail('COOKIE_SECRET', `debe tener al menos ${COOKIE_SECRET_MIN_LENGTH} caracteres`);
  }

  const logLevel = optional(env, 'LOG_LEVEL', 'info');
  if (!LOG_LEVELS.includes(logLevel)) {
    fail('LOG_LEVEL', `debe ser uno de: ${LOG_LEVELS.join(', ')}`);
  }

  return {
    port: parsePort(optional(env, 'PORT', '3001')),
    databaseUrl: required(env, 'DATABASE_URL'),
    jwtIssuer: optional(env, 'JWT_ISSUER', 'urn:fluxone:auth'),
    jwtAudience: optional(env, 'JWT_AUDIENCE', 'urn:fluxone:api'),
    cookieSecret,
    cookieSecure: parseCookieSecure(optional(env, 'COOKIE_SECURE', 'true')),
    demoUsersPassword: parseDemoUsersPassword(required(env, 'DEMO_USERS_PASSWORD')),
    logLevel,
  };
}
