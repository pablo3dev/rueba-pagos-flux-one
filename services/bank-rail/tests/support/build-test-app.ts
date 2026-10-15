import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { composeApp } from '../../src/compose.js';
import { loadConfig } from '../../src/config.js';
import type { Ledger } from '../../src/application/ports/ledger.js';
import type { RailOutcome } from '../../src/domain/outcome.js';
import { FakeDelay, SequenceOutcomePicker } from './fakes.js';

export interface TestApp {
  app: FastifyInstance;
  picker: SequenceOutcomePicker;
  delay: FakeDelay;
  ledgerPath: string;
  logs: string[];
  ledgerLines: () => Promise<unknown[]>;
  close: () => Promise<void>;
}

export async function buildTestApp(options?: {
  outcomes?: RailOutcome[];
  timeoutProcessed?: boolean[];
  weights?: string;
  timeoutDelayMs?: number;
  ledgerPath?: string;
  ledger?: Ledger;
  gatedDelay?: boolean;
  env?: NodeJS.ProcessEnv;
}): Promise<TestApp> {
  const ownedDir =
    options?.ledgerPath === undefined ? await mkdtemp(join(tmpdir(), 'bank-rail-')) : undefined;
  const ledgerPath = options?.ledgerPath ?? join(ownedDir ?? '', 'ledger.jsonl');
  const env: NodeJS.ProcessEnv = { ...(options?.env ?? {}) };
  if (options?.weights !== undefined) {
    env.RAIL_OUTCOME_WEIGHTS = options.weights;
  }
  if (options?.timeoutDelayMs !== undefined) {
    env.RAIL_TIMEOUT_DELAY_MS = String(options.timeoutDelayMs);
  }
  env.RAIL_LEDGER_PATH = ledgerPath;
  const config = loadConfig(env);
  const delay = new FakeDelay({ gated: options?.gatedDelay === true });
  const picker = new SequenceOutcomePicker({
    outcomes: options?.outcomes ?? [],
    ...(options?.timeoutProcessed !== undefined
      ? { timeoutProcessed: options.timeoutProcessed }
      : {}),
  });
  const logs: string[] = [];
  const app = await composeApp({
    config,
    delay,
    logStream: captureLogs(logs),
    ...(options?.weights === undefined ? { outcomePicker: picker } : {}),
    ...(options?.ledger !== undefined ? { ledger: options.ledger } : {}),
  });

  let closed = false;
  let removed = false;

  return {
    app,
    picker,
    delay,
    ledgerPath,
    logs,
    async ledgerLines() {
      return readLedgerLines(ledgerPath);
    },
    async close() {
      if (!closed) {
        closed = true;
        await app.close().catch((error: unknown) => {
          if (error instanceof Error && /already been closed|already closed/i.test(error.message)) {
            return;
          }
          throw error;
        });
      }
      if (ownedDir !== undefined && !removed) {
        removed = true;
        await rm(ownedDir, { recursive: true, force: true });
      }
    },
  };
}

function captureLogs(logs: string[]): Writable {
  let pending = '';
  return new Writable({
    write(chunk: Buffer | string, _encoding, callback) {
      pending += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      const parts = pending.split('\n');
      pending = parts.pop() ?? '';
      for (const part of parts) {
        if (part.length > 0) {
          logs.push(part);
        }
      }
      callback();
    },
  });
}

async function readLedgerLines(ledgerPath: string): Promise<unknown[]> {
  try {
    const text = await readFile(ledgerPath, 'utf8');
    return text
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as unknown);
  } catch (error) {
    if (isNotFound(error)) {
      return [];
    }
    throw error;
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
