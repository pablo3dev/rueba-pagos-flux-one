import { readFile } from 'node:fs/promises';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../support/build-test-app.js';

const open: TestApp[] = [];

afterEach(async () => {
  const pending = open.splice(0).reverse();
  for (const harness of pending) {
    await harness.close();
  }
});

describe('transferencias', () => {
  it('[AC-RIE-01] ACCEPTED registra la transferencia y responde 200', async () => {
    const harness = await openApp({ outcomes: ['ACCEPTED'] });
    const response = await postTransfer(harness.app, transfer('TRX-0001', '1500.50'));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ reference: 'TRX-0001', status: 'ACCEPTED' });
    const lines = await harness.ledgerLines();
    expect(lines).toEqual([
      expect.objectContaining({
        reference: 'TRX-0001',
        kind: 'TRANSFER',
        status: 'ACCEPTED',
        amount: '1500.50',
      }),
    ]);
  });

  it('[AC-RIE-02] REJECTED registra REJECTED_BY_BANK y responde 422 REJECTED', async () => {
    const harness = await openApp({ outcomes: ['REJECTED'] });
    const response = await postTransfer(harness.app, transfer('TRX-0002'));
    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: {
        code: 'REJECTED',
        message: 'El banco rechazó la operación (REJECTED_BY_BANK).',
      },
    });
    expect(await harness.ledgerLines()).toEqual([
      expect.objectContaining({
        reference: 'TRX-0002',
        status: 'REJECTED',
        reason: 'REJECTED_BY_BANK',
      }),
    ]);
  });

  it('[AC-RIE-03] UNAVAILABLE responde 503 sin línea y la referencia se puede sortear de nuevo', async () => {
    const harness = await openApp({ outcomes: ['UNAVAILABLE', 'ACCEPTED'] });
    const first = await postTransfer(harness.app, transfer('TRX-0003'));
    expect(first.statusCode).toBe(503);
    expect(first.json()).toEqual({
      error: {
        code: 'UNAVAILABLE',
        message: 'El banco no está disponible. Reintenta más tarde.',
      },
    });
    expect(await harness.ledgerLines()).toEqual([]);
    expect(harness.picker.pickCalls).toBe(1);

    const second = await postTransfer(harness.app, transfer('TRX-0003'));
    expect(second.statusCode).toBe(200);
    expect(harness.picker.pickCalls).toBe(2);
    expect(await harness.ledgerLines()).toHaveLength(1);
  });

  it('[AC-RIE-04] TIMEOUT procesado registra antes de esperar y luego responde 200', async () => {
    const timeoutDelayMs = 40;
    const harness = await openApp({
      outcomes: ['TIMEOUT'],
      timeoutProcessed: [true],
      timeoutDelayMs,
      gatedDelay: true,
    });
    const pending = postTransfer(harness.app, transfer('TRX-0004'));
    await waitFor(() => harness.delay.waits.length === 1);

    const lookup = await getTransfer(harness.app, 'TRX-0004');
    expect(lookup.statusCode).toBe(200);
    expect(lookup.json()).toEqual({ reference: 'TRX-0004', status: 'ACCEPTED' });
    expect(await harness.ledgerLines()).toHaveLength(1);

    harness.delay.release();
    const response = await pending;
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ reference: 'TRX-0004', status: 'ACCEPTED' });
    expect(harness.delay.waits).toEqual([timeoutDelayMs]);
  });

  it('[AC-RIE-05] TIMEOUT no procesado espera, responde 503 y el GET posterior es 404', async () => {
    const harness = await openApp({
      outcomes: ['TIMEOUT'],
      timeoutProcessed: [false],
      timeoutDelayMs: 15,
    });
    const response = await postTransfer(harness.app, transfer('TRX-0005'));
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: {
        code: 'UNAVAILABLE',
        message: 'El banco no está disponible. Reintenta más tarde.',
      },
    });
    expect(harness.delay.waits).toEqual([15]);
    expect(await harness.ledgerLines()).toEqual([]);
    const lookup = await getTransfer(harness.app, 'TRX-0005');
    expect(lookup.statusCode).toBe(404);
    expect(lookup.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Recurso no encontrado.' },
    });
  });

  it('[AC-RIE-06] pesos 100,0,0,0 con el sorteo real responden siempre 200', async () => {
    const harness = await openApp({ weights: '100,0,0,0' });
    for (const reference of ['W-1', 'W-2', 'W-3', 'W-4', 'W-5']) {
      const response = await postTransfer(harness.app, transfer(reference));
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ reference, status: 'ACCEPTED' });
    }
    expect(harness.picker.pickCalls).toBe(0);
  });

  it('[AC-RIE-07] cuerpos inválidos responden 400 VALIDATION_ERROR sin sortear ni registrar', async () => {
    const harness = await openApp({ outcomes: ['ACCEPTED'] });
    const cases: unknown[] = [
      transfer('', '10.00'),
      transfer('a'.repeat(256)),
      transfer('bad ref'),
      transfer('TRX-0', '0'),
      transfer('TRX-0', '0.00'),
      transfer('TRX-0', '-1'),
      transfer('TRX-0', '1.234'),
      { reference: 'TRX-0', from: 'ACC-001', to: 'EXT-0001', amount: 10 },
      { reference: 'TRX-0', to: 'EXT-0001', amount: '10.00' },
      { reference: 'TRX-0', from: 'ACC-001', amount: '10.00' },
      { from: 'ACC-001', to: 'EXT-0001', amount: '10.00' },
      { reference: 'TRX-0', from: 'ACC-001', to: 'EXT-0001', amount: '10.00', extra: 'no' },
    ];

    for (const payload of cases) {
      const response = await postTransfer(harness.app, payload);
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.stringMatching(/^Solicitud inválida: /),
        },
      });
    }

    const notJson = await harness.app.inject({
      method: 'POST',
      url: '/rail/transfers',
      headers: { 'content-type': 'application/json' },
      payload: 'no-es-json',
    });
    expect(notJson.statusCode).toBe(400);
    expect(notJson.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: expect.stringMatching(/^Solicitud inválida: /),
      },
    });

    expect(harness.picker.pickCalls).toBe(0);
    expect(await harness.ledgerLines()).toEqual([]);
    expect(await readFile(harness.ledgerPath, 'utf8')).toBe('');
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

function postTransfer(app: FastifyInstance, payload: unknown): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'POST',
    url: '/rail/transfers',
    headers: { 'content-type': 'application/json' },
    payload: payload as Record<string, unknown>,
  });
}

function getTransfer(app: FastifyInstance, reference: string): Promise<LightMyRequestResponse> {
  return app.inject({ method: 'GET', url: `/rail/transfers/${reference}` });
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > 2000) {
      throw new Error('Tiempo de espera agotado.');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
