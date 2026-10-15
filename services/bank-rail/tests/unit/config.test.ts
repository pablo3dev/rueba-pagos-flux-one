import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';

const DEFAULT_WEIGHTS = {
  ACCEPTED: 25,
  REJECTED: 25,
  UNAVAILABLE: 25,
  TIMEOUT: 25,
};

function expectInvalid(env: NodeJS.ProcessEnv, variable: string): void {
  let thrown: unknown;
  try {
    loadConfig(env);
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(Error);
  expect((thrown as Error).message).toContain(variable);
}

describe('loadConfig', () => {
  it('[AC-RIE-30] sin variables usa los defaults de puerto, pesos, espera, ledger y nivel', () => {
    expect(loadConfig({})).toEqual({
      port: 3004,
      outcomeWeights: DEFAULT_WEIGHTS,
      timeoutDelayMs: 15000,
      ledgerPath: '/data/rail-ledger.jsonl',
      logLevel: 'info',
    });
  });

  it('[AC-RIE-30] con valores válidos los respeta', () => {
    expect(
      loadConfig({
        PORT: '8080',
        RAIL_OUTCOME_WEIGHTS: '100,0,0,0',
        RAIL_TIMEOUT_DELAY_MS: '0',
        RAIL_LEDGER_PATH: '/tmp/rail-ledger.jsonl',
        LOG_LEVEL: 'debug',
      }),
    ).toEqual({
      port: 8080,
      outcomeWeights: { ACCEPTED: 100, REJECTED: 0, UNAVAILABLE: 0, TIMEOUT: 0 },
      timeoutDelayMs: 0,
      ledgerPath: '/tmp/rail-ledger.jsonl',
      logLevel: 'debug',
    });

    expect(
      loadConfig({
        PORT: '1',
        RAIL_TIMEOUT_DELAY_MS: '2147483647',
        RAIL_LEDGER_PATH: 'ledger.jsonl',
        LOG_LEVEL: 'silent',
      }),
    ).toMatchObject({
      port: 1,
      timeoutDelayMs: 2147483647,
      ledgerPath: 'ledger.jsonl',
      logLevel: 'silent',
    });

    expect(loadConfig({ PORT: '65535' }).port).toBe(65535);
  });

  it.each(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])(
    '[AC-RIE-30] acepta LOG_LEVEL %s',
    (logLevel) => {
      expect(loadConfig({ LOG_LEVEL: logLevel }).logLevel).toBe(logLevel);
    },
  );

  it.each(['1,2,3', 'a,b,c,d', '-1,2,3,4', '0,0,0,0', '25, 25,25,25'])(
    '[AC-RIE-31] pesos inválidos %s nombran RAIL_OUTCOME_WEIGHTS',
    (raw) => {
      let thrown: unknown;
      try {
        loadConfig({ RAIL_OUTCOME_WEIGHTS: raw });
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message.startsWith('RAIL_OUTCOME_WEIGHTS inválido: ')).toBe(true);
    },
  );

  it.each([
    ['PORT', '0'],
    ['PORT', '65536'],
    ['PORT', '-1'],
    ['PORT', '3004.5'],
    ['PORT', ''],
    ['RAIL_TIMEOUT_DELAY_MS', '1.5'],
    ['RAIL_TIMEOUT_DELAY_MS', '-1'],
    ['RAIL_TIMEOUT_DELAY_MS', '2147483648'],
    ['RAIL_TIMEOUT_DELAY_MS', ''],
    ['RAIL_LEDGER_PATH', ''],
    ['LOG_LEVEL', 'verbose'],
    ['LOG_LEVEL', ''],
    ['RAIL_OUTCOME_WEIGHTS', ''],
  ] as const)(
    '[AC-RIE-32] %s inválida nombra la variable y no toma el default',
    (variable, value) => {
      expectInvalid({ [variable]: value }, variable);
    },
  );
});
