import { parseOutcomeWeights, type OutcomeWeights } from './domain/outcome.js';

export interface Config {
  port: number;
  outcomeWeights: OutcomeWeights;
  timeoutDelayMs: number;
  ledgerPath: string;
  logLevel: string;
}

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const DEFAULT_PORT = '3004';
const DEFAULT_OUTCOME_WEIGHTS = '25,25,25,25';
const DEFAULT_TIMEOUT_DELAY_MS = '15000';
const DEFAULT_LEDGER_PATH = '/data/rail-ledger.jsonl';
const DEFAULT_LOG_LEVEL = 'info';
const MAX_PORT = 65535;
const MAX_TIMEOUT_DELAY_MS = 2147483647;

function fail(variable: string, rule: string): never {
  throw new Error(`${variable} ${rule}`);
}

// Una clave presente, aunque su valor sea '', se valida. Solo la ausencia usa el default.
function readEnv(env: NodeJS.ProcessEnv, variable: string, fallback: string): string {
  const value = env[variable];
  return value === undefined ? fallback : value;
}

function parsePort(raw: string): number {
  if (!/^[0-9]+$/.test(raw)) {
    fail('PORT', 'debe ser un entero entre 1 y 65535');
  }
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > MAX_PORT) {
    fail('PORT', 'debe ser un entero entre 1 y 65535');
  }
  return port;
}

function parseTimeoutDelayMs(raw: string): number {
  if (!/^[0-9]+$/.test(raw)) {
    fail('RAIL_TIMEOUT_DELAY_MS', 'debe ser un entero entre 0 y 2147483647');
  }
  const delayMs = Number(raw);
  if (!Number.isInteger(delayMs) || delayMs < 0 || delayMs > MAX_TIMEOUT_DELAY_MS) {
    fail('RAIL_TIMEOUT_DELAY_MS', 'debe ser un entero entre 0 y 2147483647');
  }
  return delayMs;
}

function parseLedgerPath(raw: string): string {
  if (raw.length === 0) {
    fail('RAIL_LEDGER_PATH', 'debe ser un texto no vacío');
  }
  return raw;
}

function parseLogLevel(raw: string): string {
  if (!(LOG_LEVELS as readonly string[]).includes(raw)) {
    fail('LOG_LEVEL', `debe ser uno de: ${LOG_LEVELS.join(', ')}`);
  }
  return raw;
}

function parseWeights(raw: string): OutcomeWeights {
  try {
    return parseOutcomeWeights(raw);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`RAIL_OUTCOME_WEIGHTS inválido: ${detail}`, { cause: error });
  }
}

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  return {
    port: parsePort(readEnv(env, 'PORT', DEFAULT_PORT)),
    outcomeWeights: parseWeights(readEnv(env, 'RAIL_OUTCOME_WEIGHTS', DEFAULT_OUTCOME_WEIGHTS)),
    timeoutDelayMs: parseTimeoutDelayMs(
      readEnv(env, 'RAIL_TIMEOUT_DELAY_MS', DEFAULT_TIMEOUT_DELAY_MS),
    ),
    ledgerPath: parseLedgerPath(readEnv(env, 'RAIL_LEDGER_PATH', DEFAULT_LEDGER_PATH)),
    logLevel: parseLogLevel(readEnv(env, 'LOG_LEVEL', DEFAULT_LOG_LEVEL)),
  };
}
