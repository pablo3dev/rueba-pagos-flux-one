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

describe('reversos', () => {
  it('[AC-RIE-16] un reverso válido aceptado responde 200 y guarda originalReference', async () => {
    const harness = await openApp({ outcomes: ['ACCEPTED', 'ACCEPTED'] });
    await postTransfer(harness.app, transfer('TRX-0001', '1500.50'));
    const response = await postReversal(harness.app, reversal('REV-0001', 'TRX-0001', '1500.50'));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ reference: 'REV-0001', status: 'ACCEPTED' });
    expect(await harness.ledgerLines()).toEqual([
      expect.objectContaining({ reference: 'TRX-0001', kind: 'TRANSFER', status: 'ACCEPTED' }),
      expect.objectContaining({
        reference: 'REV-0001',
        kind: 'REVERSAL',
        originalReference: 'TRX-0001',
        amount: '1500.50',
        status: 'ACCEPTED',
      }),
    ]);
  });

  it('[AC-RIE-17] ORIGINAL_NOT_FOUND responde 422, queda registrado y no sortea', async () => {
    const harness = await openApp({ outcomes: ['ACCEPTED'] });
    const response = await postReversal(harness.app, reversal('REV-NF', 'TRX-AUSENTE'));
    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: { code: 'ORIGINAL_NOT_FOUND', message: 'La operación original no existe.' },
    });
    expect(harness.picker.pickCalls).toBe(0);
    expect(await harness.ledgerLines()).toEqual([
      expect.objectContaining({
        reference: 'REV-NF',
        status: 'REJECTED',
        reason: 'ORIGINAL_NOT_FOUND',
      }),
    ]);
  });

  it('[AC-RIE-18] ORIGINAL_NOT_ACCEPTED cubre una original rechazada y un reverso aceptado', async () => {
    const harness = await openApp({ outcomes: ['REJECTED', 'ACCEPTED', 'ACCEPTED'] });
    await postTransfer(harness.app, transfer('TRX-REJ'));
    const calls = harness.picker.pickCalls;
    const rejectedOriginal = await postReversal(harness.app, reversal('REV-REJ', 'TRX-REJ'));
    expect(rejectedOriginal.statusCode).toBe(422);
    expect(rejectedOriginal.json()).toEqual({
      error: {
        code: 'ORIGINAL_NOT_ACCEPTED',
        message: 'La operación original no fue aceptada o no es una transferencia.',
      },
    });
    expect(harness.picker.pickCalls).toBe(calls);

    await postTransfer(harness.app, transfer('TRX-OK'));
    await postReversal(harness.app, reversal('REV-OK', 'TRX-OK'));
    const callsAfter = harness.picker.pickCalls;
    const reversalOfReversal = await postReversal(harness.app, reversal('REV-REV', 'REV-OK'));
    expect(reversalOfReversal.statusCode).toBe(422);
    expect(reversalOfReversal.json()).toEqual({
      error: {
        code: 'ORIGINAL_NOT_ACCEPTED',
        message: 'La operación original no fue aceptada o no es una transferencia.',
      },
    });
    expect(harness.picker.pickCalls).toBe(callsAfter);
    expect(await harness.ledgerLines()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reference: 'REV-REJ', reason: 'ORIGINAL_NOT_ACCEPTED' }),
        expect.objectContaining({ reference: 'REV-REV', reason: 'ORIGINAL_NOT_ACCEPTED' }),
      ]),
    );
  });

  it('[AC-RIE-19] AMOUNT_MISMATCH responde 422 con su código y no sortea', async () => {
    const harness = await openApp({ outcomes: ['ACCEPTED'] });
    await postTransfer(harness.app, transfer('TRX-AMT', '10.00'));
    const calls = harness.picker.pickCalls;
    const response = await postReversal(harness.app, reversal('REV-AMT', 'TRX-AMT', '11.00'));
    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: {
        code: 'AMOUNT_MISMATCH',
        message: 'El monto no coincide con el de la operación original.',
      },
    });
    expect(harness.picker.pickCalls).toBe(calls);
    expect(await harness.ledgerLines()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reference: 'REV-AMT', reason: 'AMOUNT_MISMATCH' }),
      ]),
    );
  });

  it('[AC-RIE-20] ALREADY_REVERSED no cuenta un reverso previo rechazado', async () => {
    const harness = await openApp({ outcomes: ['ACCEPTED', 'ACCEPTED', 'ACCEPTED'] });
    await postTransfer(harness.app, transfer('TRX-ALR'));
    const rejectedFirst = await postReversal(harness.app, reversal('REV-BAD', 'TRX-ALR', '12.00'));
    expect(rejectedFirst.json()).toEqual({
      error: {
        code: 'AMOUNT_MISMATCH',
        message: 'El monto no coincide con el de la operación original.',
      },
    });
    const calls = harness.picker.pickCalls;
    const drawn = await postReversal(harness.app, reversal('REV-OK', 'TRX-ALR'));
    expect(drawn.statusCode).toBe(200);
    expect(harness.picker.pickCalls).toBe(calls + 1);

    const again = await postReversal(harness.app, reversal('REV-DUP', 'TRX-ALR'));
    expect(again.statusCode).toBe(422);
    expect(again.json()).toEqual({
      error: {
        code: 'ALREADY_REVERSED',
        message: 'La operación original ya fue reversada.',
      },
    });
    expect(harness.picker.pickCalls).toBe(calls + 1);
    expect(await harness.ledgerLines()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reference: 'REV-DUP', reason: 'ALREADY_REVERSED' }),
      ]),
    );
  });

  it('[AC-RIE-21] el orden de reglas gana a la primera, la validación va antes y la idempotencia también', async () => {
    const harness = await openApp({
      outcomes: ['ACCEPTED', 'REJECTED', 'ACCEPTED', 'ACCEPTED'],
    });

    const invalid = await postReversal(harness.app, { reference: 'REV-BAD' });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: expect.stringMatching(/^Solicitud inválida: /),
      },
    });
    expect(harness.picker.pickCalls).toBe(0);
    expect(await harness.ledgerLines()).toEqual([]);

    const missing = await postReversal(harness.app, reversal('REV-FIRST', 'TRX-NO', '1.00'));
    expect(missing.json()).toEqual({
      error: { code: 'ORIGINAL_NOT_FOUND', message: 'La operación original no existe.' },
    });
    const stored = await readFile(harness.ledgerPath, 'utf8');
    const calls = harness.picker.pickCalls;
    await postTransfer(harness.app, transfer('TRX-NO', '1.00'));
    const repeated = await postReversal(harness.app, reversal('REV-FIRST', 'TRX-NO', '1.00'));
    expect(repeated.statusCode).toBe(422);
    expect(repeated.json()).toEqual(missing.json());
    expect(harness.picker.pickCalls).toBe(calls + 1);
    const linesAfterRepeat = await harness.ledgerLines();
    expect(linesAfterRepeat.filter((line) => isReference(line, 'REV-FIRST'))).toHaveLength(1);
    expect(await readFile(harness.ledgerPath, 'utf8')).toContain(
      stored.trim().split('\n')[0] ?? '',
    );

    await postTransfer(harness.app, transfer('TRX-REJ'));
    const rejectedAndAmount = await postReversal(
      harness.app,
      reversal('REV-ORD-1', 'TRX-REJ', '99.00'),
    );
    expect(rejectedAndAmount.json()).toEqual({
      error: {
        code: 'ORIGINAL_NOT_ACCEPTED',
        message: 'La operación original no fue aceptada o no es una transferencia.',
      },
    });

    await postTransfer(harness.app, transfer('TRX-BOTH'));
    await postReversal(harness.app, reversal('REV-BOTH-OK', 'TRX-BOTH'));
    const amountBeforeAlready = await postReversal(
      harness.app,
      reversal('REV-BOTH-BAD', 'TRX-BOTH', '99.00'),
    );
    expect(amountBeforeAlready.json()).toEqual({
      error: {
        code: 'AMOUNT_MISMATCH',
        message: 'El monto no coincide con el de la operación original.',
      },
    });
  });

  it('[AC-RIE-22] repetir un reverso conserva status y code; un payload distinto o una transferencia conflicta', async () => {
    const harness = await openApp({ outcomes: ['ACCEPTED', 'ACCEPTED'] });
    await postTransfer(harness.app, transfer('TRX-ID'));
    const first = await postReversal(harness.app, reversal('REV-ID', 'TRX-ID'));
    const calls = harness.picker.pickCalls;
    const file = await readFile(harness.ledgerPath, 'utf8');
    const repeated = await postReversal(harness.app, reversal('REV-ID', 'TRX-ID', '10.00'));
    expect(repeated.statusCode).toBe(first.statusCode);
    expect(repeated.json()).toEqual(first.json());
    expect(harness.picker.pickCalls).toBe(calls);
    expect(await readFile(harness.ledgerPath, 'utf8')).toBe(file);

    const otherOriginal = await postReversal(harness.app, reversal('REV-ID', 'TRX-OTRA'));
    const otherAmount = await postReversal(harness.app, reversal('REV-ID', 'TRX-ID', '12.00'));
    expect(otherOriginal.statusCode).toBe(409);
    expect(otherAmount.statusCode).toBe(409);
    expect(otherOriginal.json()).toEqual({
      error: {
        code: 'REFERENCE_CONFLICT',
        message: 'La referencia ya existe con datos distintos.',
      },
    });
    expect(await readFile(harness.ledgerPath, 'utf8')).toBe(file);

    const asTransfer = await postReversal(harness.app, reversal('TRX-ID', 'TRX-ID'));
    expect(asTransfer.statusCode).toBe(409);
    expect(asTransfer.json()).toEqual({
      error: {
        code: 'REFERENCE_CONFLICT',
        message: 'La referencia ya existe con datos distintos.',
      },
    });
    expect(await readFile(harness.ledgerPath, 'utf8')).toBe(file);
  });

  it('[AC-RIE-23] tras las reglas, el sorteo de un reverso sigue la semántica de la transferencia', async () => {
    const harness = await openApp({
      outcomes: [
        'ACCEPTED',
        'ACCEPTED',
        'ACCEPTED',
        'ACCEPTED',
        'REJECTED',
        'UNAVAILABLE',
        'TIMEOUT',
        'TIMEOUT',
      ],
      timeoutProcessed: [true, false],
      timeoutDelayMs: 12,
    });
    await postTransfer(harness.app, transfer('TRX-R'));
    await postTransfer(harness.app, transfer('TRX-U'));
    await postTransfer(harness.app, transfer('TRX-TP'));
    await postTransfer(harness.app, transfer('TRX-TN'));

    const rejected = await postReversal(harness.app, reversal('REV-R', 'TRX-R'));
    expect(rejected.statusCode).toBe(422);
    expect(rejected.json()).toEqual({
      error: {
        code: 'REJECTED',
        message: 'El banco rechazó la operación (REJECTED_BY_BANK).',
      },
    });

    const beforeUnavailable = (await harness.ledgerLines()).length;
    const unavailable = await postReversal(harness.app, reversal('REV-U', 'TRX-U'));
    expect(unavailable.statusCode).toBe(503);
    expect(await harness.ledgerLines()).toHaveLength(beforeUnavailable);

    const processed = await postReversal(harness.app, reversal('REV-TP', 'TRX-TP'));
    expect(processed.statusCode).toBe(200);
    expect(harness.delay.waits).toEqual([12]);
    const during = await getTransfer(harness.app, 'REV-TP');
    expect(during.statusCode).toBe(200);

    const waits = harness.delay.waits.length;
    const notProcessed = await postReversal(harness.app, reversal('REV-TN', 'TRX-TN'));
    expect(notProcessed.statusCode).toBe(503);
    expect(harness.delay.waits).toHaveLength(waits + 1);
    const missing = await getTransfer(harness.app, 'REV-TN');
    expect(missing.statusCode).toBe(404);
  });

  it('dos reversos simultáneos de la misma original dejan como máximo uno aceptado', async () => {
    const harness = await openApp({ outcomes: ['ACCEPTED', 'ACCEPTED', 'ACCEPTED'] });
    await postTransfer(harness.app, transfer('TRX-RACE'));
    const [left, right] = await Promise.all([
      postReversal(harness.app, reversal('REV-RACE-1', 'TRX-RACE')),
      postReversal(harness.app, reversal('REV-RACE-2', 'TRX-RACE')),
    ]);
    const codes = [left.statusCode, right.statusCode].sort((a, b) => a - b);
    expect(codes).toEqual([200, 422]);
    const bodies = [left.json(), right.json()];
    expect(bodies).toEqual(
      expect.arrayContaining([
        { reference: expect.any(String), status: 'ACCEPTED' },
        {
          error: {
            code: 'ALREADY_REVERSED',
            message: 'La operación original ya fue reversada.',
          },
        },
      ]),
    );
    const accepted = (await harness.ledgerLines()).filter(
      (line) => isKind(line, 'REVERSAL') && isStatus(line, 'ACCEPTED'),
    );
    expect(accepted).toHaveLength(1);
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

function reversal(reference: string, originalReference: string, amount = '10.00') {
  return { reference, originalReference, amount };
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
  return app.inject({ method: 'GET', url: `/rail/transfers/${reference}` });
}

function isReference(line: unknown, reference: string): boolean {
  return (
    typeof line === 'object' && line !== null && 'reference' in line && line.reference === reference
  );
}

function isKind(line: unknown, kind: string): boolean {
  return typeof line === 'object' && line !== null && 'kind' in line && line.kind === kind;
}

function isStatus(line: unknown, status: string): boolean {
  return typeof line === 'object' && line !== null && 'status' in line && line.status === status;
}
