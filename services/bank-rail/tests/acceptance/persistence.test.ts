import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { JsonlFileLedger } from '../../src/adapters/outbound/ledger/jsonl-file-ledger.js';
import type { Ledger } from '../../src/application/ports/ledger.js';
import type { BankOperation } from '../../src/domain/operation.js';
import { buildTestApp, type TestApp } from '../support/build-test-app.js';
import { FlakyLedger } from '../support/fakes.js';

const ACCEPTED_LINE =
  '{"reference":"TRX-KEEP","kind":"TRANSFER","from":"ACC-001","to":"EXT-0001","amount":"10.00","status":"ACCEPTED","recordedAt":"2026-10-15T14:00:00.000Z"}';

const open: TestApp[] = [];
const dirs: string[] = [];

afterEach(async () => {
  const pending = open.splice(0).reverse();
  for (const harness of pending) {
    await harness.close();
  }
  const created = dirs.splice(0);
  await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('persistencia del ledger', () => {
  it('[AC-RIE-24] el POST responde después de que la línea está en el archivo', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bank-rail-'));
    dirs.push(dir);
    const ledgerPath = join(dir, 'ledger.jsonl');
    const inner = await JsonlFileLedger.open(ledgerPath);
    const ledger = new ConfirmingLedger(inner, ledgerPath);
    const harness = await buildTestApp({
      outcomes: ['ACCEPTED'],
      ledger,
      ledgerPath,
    });
    open.push(harness);

    const response = await postTransfer(harness.app, transfer('TRX-WRITE'));
    expect(response.statusCode).toBe(200);
    expect(ledger.sawLineBeforeAppendResolved).toBe(true);
    expect(await harness.ledgerLines()).toEqual([
      expect.objectContaining({ reference: 'TRX-WRITE', status: 'ACCEPTED' }),
    ]);
  });

  it('[AC-RIE-25] al recomponer sobre el mismo archivo se conservan aceptadas y rechazadas', async () => {
    const first = await buildTestApp({ outcomes: ['ACCEPTED', 'REJECTED'] });
    open.push(first);
    await postTransfer(first.app, transfer('TRX-A'));
    await postTransfer(first.app, transfer('TRX-B'));
    await first.app.close();

    const second = await buildTestApp({
      ledgerPath: first.ledgerPath,
      outcomes: ['ACCEPTED'],
    });
    open.push(second);
    expect(second.picker.pickCalls).toBe(0);

    const accepted = await getTransfer(second.app, 'TRX-A');
    const rejected = await getTransfer(second.app, 'TRX-B');
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toEqual({ reference: 'TRX-A', status: 'ACCEPTED' });
    expect(rejected.statusCode).toBe(422);
    expect(rejected.json()).toEqual({
      error: {
        code: 'REJECTED',
        message: 'La operación fue rechazada (REJECTED_BY_BANK).',
      },
    });

    const repeated = await postTransfer(second.app, transfer('TRX-A'));
    const repeatedRejected = await postTransfer(second.app, transfer('TRX-B'));
    expect(repeated.statusCode).toBe(200);
    expect(repeatedRejected.statusCode).toBe(422);
    expect(second.picker.pickCalls).toBe(0);
    expect(await second.ledgerLines()).toHaveLength(2);
  });

  it('[AC-RIE-27] una última línea truncada arranca con advertencia y conserva el resto', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bank-rail-'));
    dirs.push(dir);
    const ledgerPath = join(dir, 'ledger.jsonl');
    await writeFile(ledgerPath, `${ACCEPTED_LINE}\n{"reference":"TRUNC`, 'utf8');

    const harness = await buildTestApp({ ledgerPath, outcomes: [] });
    open.push(harness);

    const warnings = harness.logs
      .map((line) => JSON.parse(line) as { event?: string; line?: number })
      .filter((line) => line.event === 'rail.ledger_truncated_line_discarded');
    expect(warnings).toEqual([expect.objectContaining({ line: 2 })]);

    const lookup = await getTransfer(harness.app, 'TRX-KEEP');
    expect(lookup.statusCode).toBe(200);
    expect(await harness.ledgerLines()).toEqual([
      expect.objectContaining({ reference: 'TRX-KEEP', status: 'ACCEPTED' }),
    ]);
  });

  it('[AC-RIE-28] una línea intermedia corrupta rechaza la composición e indica el número de línea', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bank-rail-'));
    dirs.push(dir);
    const ledgerPath = join(dir, 'ledger.jsonl');
    const seeded = `${ACCEPTED_LINE}\n{corrupta}\n${ACCEPTED_LINE}\n`;
    await writeFile(ledgerPath, seeded, 'utf8');

    await expect(buildTestApp({ ledgerPath, outcomes: [] })).rejects.toThrow(/línea 2/);
    expect(await readFile(ledgerPath, 'utf8')).toBe(seeded);
  });

  it('[AC-RIE-29] un fallo de escritura responde 503 y el GET posterior es 404', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bank-rail-'));
    dirs.push(dir);
    const ledgerPath = join(dir, 'ledger.jsonl');
    const ledger = new FlakyLedger(await JsonlFileLedger.open(ledgerPath));
    ledger.failWrites = true;
    const harness = await buildTestApp({
      outcomes: ['ACCEPTED'],
      ledger,
      ledgerPath,
    });
    open.push(harness);

    const response = await postTransfer(harness.app, transfer('TRX-FAIL'));
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: {
        code: 'UNAVAILABLE',
        message: 'El banco no está disponible. Reintenta más tarde.',
      },
    });

    ledger.failWrites = false;
    const lookup = await getTransfer(harness.app, 'TRX-FAIL');
    expect(lookup.statusCode).toBe(404);
    expect(await harness.ledgerLines()).toEqual([]);
  });
});

class ConfirmingLedger implements Ledger {
  sawLineBeforeAppendResolved = false;

  constructor(
    private readonly inner: Ledger,
    private readonly ledgerPath: string,
  ) {}

  find(reference: string): Promise<BankOperation | undefined> {
    return this.inner.find(reference);
  }

  findAcceptedReversalOf(originalReference: string): Promise<BankOperation | undefined> {
    return this.inner.findAcceptedReversalOf(originalReference);
  }

  async append(operation: BankOperation): Promise<void> {
    await this.inner.append(operation);
    const text = await readFile(this.ledgerPath, 'utf8');
    this.sawLineBeforeAppendResolved = text.includes(operation.reference);
  }
}

function transfer(reference: string) {
  return { reference, from: 'ACC-001', to: 'EXT-0001', amount: '10.00' };
}

function postTransfer(app: FastifyInstance, payload: unknown) {
  return app.inject({
    method: 'POST',
    url: '/rail/transfers',
    headers: { 'content-type': 'application/json' },
    payload: payload as Record<string, unknown>,
  });
}

function getTransfer(app: FastifyInstance, reference: string) {
  return app.inject({ method: 'GET', url: `/rail/transfers/${reference}` });
}
