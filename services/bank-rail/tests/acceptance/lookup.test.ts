import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { JsonlFileLedger } from '../../src/adapters/outbound/ledger/jsonl-file-ledger.js';
import { buildTestApp, type TestApp } from '../support/build-test-app.js';
import { FlakyLedger } from '../support/fakes.js';

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

describe('consulta de operaciones', () => {
  it('[AC-RIE-11] GET de una transferencia aceptada responde 200', async () => {
    const harness = await openApp({ outcomes: ['ACCEPTED'] });
    await postTransfer(harness.app, transfer('TRX-OK'));
    const response = await getTransfer(harness.app, 'TRX-OK');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ reference: 'TRX-OK', status: 'ACCEPTED' });
  });

  it('[AC-RIE-12] GET de un reverso aceptado responde 200', async () => {
    const harness = await openApp({ outcomes: ['ACCEPTED', 'ACCEPTED'] });
    await postTransfer(harness.app, transfer('TRX-REV'));
    await postReversal(harness.app, reversal('REV-OK', 'TRX-REV'));
    const response = await getTransfer(harness.app, 'REV-OK');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ reference: 'REV-OK', status: 'ACCEPTED' });
  });

  it('[AC-RIE-13] GET de una operación rechazada responde 422 con el motivo', async () => {
    const harness = await openApp({ outcomes: ['REJECTED'] });
    await postTransfer(harness.app, transfer('TRX-NO'));
    const response = await getTransfer(harness.app, 'TRX-NO');
    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: {
        code: 'REJECTED',
        message: 'La operación fue rechazada (REJECTED_BY_BANK).',
      },
    });

    const ruled = await openApp({ outcomes: ['ACCEPTED'] });
    await postReversal(ruled.app, reversal('REV-MISS', 'TRX-AUSENTE'));
    const ruledGet = await getTransfer(ruled.app, 'REV-MISS');
    expect(ruledGet.statusCode).toBe(422);
    expect(ruledGet.json()).toEqual({
      error: {
        code: 'REJECTED',
        message: 'La operación fue rechazada (ORIGINAL_NOT_FOUND).',
      },
    });
  });

  it('[AC-RIE-14] sin registro, referencia inválida, UNAVAILABLE o TIMEOUT no procesado responden 404 y el GET no escribe', async () => {
    const harness = await openApp({
      outcomes: ['UNAVAILABLE', 'TIMEOUT', 'ACCEPTED'],
      timeoutProcessed: [false],
      timeoutDelayMs: 5,
    });
    const missing = await getTransfer(harness.app, 'TRX-NADA');
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Recurso no encontrado.' },
    });

    const invalid = await getTransfer(harness.app, 'bad ref');
    expect(invalid.statusCode).toBe(404);
    expect(invalid.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Recurso no encontrado.' },
    });

    await postTransfer(harness.app, transfer('TRX-U'));
    const unavailable = await getTransfer(harness.app, 'TRX-U');
    expect(unavailable.statusCode).toBe(404);

    await postTransfer(harness.app, transfer('TRX-T'));
    const timedOut = await getTransfer(harness.app, 'TRX-T');
    expect(timedOut.statusCode).toBe(404);

    await postTransfer(harness.app, transfer('TRX-KEEP'));
    const before = await readFile(harness.ledgerPath, 'utf8');
    const calls = harness.picker.pickCalls;
    const again = await getTransfer(harness.app, 'TRX-KEEP');
    const third = await getTransfer(harness.app, 'TRX-KEEP');
    expect(again.statusCode).toBe(200);
    expect(third.statusCode).toBe(200);
    expect(harness.picker.pickCalls).toBe(calls);
    expect(await readFile(harness.ledgerPath, 'utf8')).toBe(before);
  });

  it('[AC-RIE-15] con fallos de lectura el GET responde 503 UNAVAILABLE', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bank-rail-'));
    dirs.push(dir);
    const ledgerPath = join(dir, 'ledger.jsonl');
    const ledger = new FlakyLedger(await JsonlFileLedger.open(ledgerPath));
    const harness = await buildTestApp({
      outcomes: ['ACCEPTED'],
      ledger,
      ledgerPath,
    });
    open.push(harness);
    await postTransfer(harness.app, transfer('TRX-READ'));
    ledger.failReads = true;
    const response = await getTransfer(harness.app, 'TRX-READ');
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: {
        code: 'UNAVAILABLE',
        message: 'El banco no está disponible. Reintenta más tarde.',
      },
    });
  });
});

async function openApp(options?: Parameters<typeof buildTestApp>[0]): Promise<TestApp> {
  const harness = await buildTestApp(options);
  open.push(harness);
  return harness;
}

function transfer(reference: string) {
  return { reference, from: 'ACC-001', to: 'EXT-0001', amount: '10.00' };
}

function reversal(reference: string, originalReference: string) {
  return { reference, originalReference, amount: '10.00' };
}

function postTransfer(app: FastifyInstance, payload: unknown) {
  return app.inject({
    method: 'POST',
    url: '/rail/transfers',
    headers: { 'content-type': 'application/json' },
    payload: payload as Record<string, unknown>,
  });
}

function postReversal(app: FastifyInstance, payload: unknown) {
  return app.inject({
    method: 'POST',
    url: '/rail/reversals',
    headers: { 'content-type': 'application/json' },
    payload: payload as Record<string, unknown>,
  });
}

function getTransfer(app: FastifyInstance, reference: string) {
  return app.inject({
    method: 'GET',
    url: `/rail/transfers/${encodeURIComponent(reference)}`,
  });
}
