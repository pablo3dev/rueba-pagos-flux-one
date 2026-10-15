import { readFile } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../support/build-test-app.js';

const open: TestApp[] = [];

afterEach(async () => {
  const pending = open.splice(0).reverse();
  for (const harness of pending) {
    await harness.close();
  }
});

describe('idempotencia de transferencias', () => {
  it('[AC-RIE-08] repetir la referencia con los mismos datos, incluido 10 y 10.00, devuelve el mismo resultado', async () => {
    const harness = await openApp({ outcomes: ['ACCEPTED', 'REJECTED'] });
    const first = await postTransfer(harness.app, transfer('TRX-10', '10'));
    const calls = harness.picker.pickCalls;
    const waits = [...harness.delay.waits];
    const file = await readFile(harness.ledgerPath, 'utf8');

    const second = await postTransfer(harness.app, transfer('TRX-10', '10.00'));
    expect(second.statusCode).toBe(first.statusCode);
    expect(second.json()).toEqual(first.json());
    expect(second.json()).toEqual({ reference: 'TRX-10', status: 'ACCEPTED' });
    expect(harness.picker.pickCalls).toBe(calls);
    expect(harness.delay.waits).toEqual(waits);
    expect(await readFile(harness.ledgerPath, 'utf8')).toBe(file);
    expect(await harness.ledgerLines()).toHaveLength(1);

    const rejected = await postTransfer(harness.app, transfer('TRX-REJ'));
    expect(rejected.statusCode).toBe(422);
    const afterReject = await readFile(harness.ledgerPath, 'utf8');
    const repeatedReject = await postTransfer(harness.app, transfer('TRX-REJ', '10.00'));
    expect(repeatedReject.statusCode).toBe(422);
    expect(repeatedReject.json()).toEqual(rejected.json());
    expect(harness.picker.pickCalls).toBe(2);
    expect(await readFile(harness.ledgerPath, 'utf8')).toBe(afterReject);
  });

  it('[AC-RIE-09] la misma referencia con datos distintos o de un reverso responde 409', async () => {
    const harness = await openApp({ outcomes: ['ACCEPTED', 'ACCEPTED'] });
    await postTransfer(harness.app, transfer('TRX-C'));
    const before = await readFile(harness.ledgerPath, 'utf8');

    for (const payload of [
      { ...transfer('TRX-C'), from: 'ACC-999' },
      { ...transfer('TRX-C'), to: 'EXT-9999' },
      { ...transfer('TRX-C'), amount: '11.00' },
    ]) {
      const response = await postTransfer(harness.app, payload);
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({
        error: {
          code: 'REFERENCE_CONFLICT',
          message: 'La referencia ya existe con datos distintos.',
        },
      });
      expect(await readFile(harness.ledgerPath, 'utf8')).toBe(before);
    }

    await postReversal(harness.app, {
      reference: 'REV-C',
      originalReference: 'TRX-C',
      amount: '10.00',
    });
    const afterReversal = await readFile(harness.ledgerPath, 'utf8');
    const conflict = await postTransfer(harness.app, transfer('REV-C', '99.00'));
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toEqual({
      error: {
        code: 'REFERENCE_CONFLICT',
        message: 'La referencia ya existe con datos distintos.',
      },
    });
    expect(await readFile(harness.ledgerPath, 'utf8')).toBe(afterReversal);
    expect(harness.picker.pickCalls).toBe(2);
  });

  it('[AC-RIE-10] dos POST simultáneos con la misma referencia sortean y registran una sola vez', async () => {
    const harness = await openApp({ outcomes: ['ACCEPTED', 'REJECTED'] });
    const body = transfer('TRX-PAR');
    const [left, right] = await Promise.all([
      postTransfer(harness.app, body),
      postTransfer(harness.app, body),
    ]);
    expect(left.statusCode).toBe(200);
    expect(right.json()).toEqual(left.json());
    expect(harness.picker.pickCalls).toBe(1);
    expect(await harness.ledgerLines()).toHaveLength(1);
  });
});

async function openApp(options?: Parameters<typeof buildTestApp>[0]): Promise<TestApp> {
  const harness = await buildTestApp(options);
  open.push(harness);
  return harness;
}

function transfer(reference: string, amount = '10.00') {
  return { reference, from: 'ACC-001', to: 'EXT-0001', amount };
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
