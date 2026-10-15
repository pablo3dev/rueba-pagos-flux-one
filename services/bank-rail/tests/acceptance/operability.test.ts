import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import type { Ledger } from '../../src/application/ports/ledger.js';
import type { BankOperation } from '../../src/domain/operation.js';
import { buildTestApp, type TestApp } from '../support/build-test-app.js';

const open: TestApp[] = [];

afterEach(async () => {
  const pending = open.splice(0).reverse();
  for (const harness of pending) {
    await harness.close();
  }
});

describe('operabilidad HTTP', () => {
  it('[AC-RIE-34] GET /health responde 200 {status:"ok"}', async () => {
    const harness = await openApp();
    const response = await harness.app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('[AC-RIE-36] GET /health con Authorization responde igual que sin ella', async () => {
    const harness = await openApp();
    const plain = await harness.app.inject({ method: 'GET', url: '/health' });
    const authorized = await harness.app.inject({
      method: 'GET',
      url: '/health',
      headers: { authorization: 'Bearer secreto-health' },
    });
    expect(authorized.statusCode).toBe(plain.statusCode);
    expect(authorized.json()).toEqual(plain.json());
  });

  it('[AC-RIE-36] POST y GET con Authorization responden igual que sin ella', async () => {
    const harness = await openApp({ outcomes: ['ACCEPTED', 'ACCEPTED'] });
    const body = transfer('TRX-AUTH');
    const headers = { authorization: 'Bearer secreto-post', cookie: 'session=secreto-cookie' };
    const plain = await postTransfer(harness.app, body);
    const authorized = await postTransfer(harness.app, body, headers);
    expect(authorized.statusCode).toBe(plain.statusCode);
    expect(authorized.json()).toEqual(plain.json());

    const plainGet = await getTransfer(harness.app, 'TRX-AUTH');
    const authorizedGet = await getTransfer(harness.app, 'TRX-AUTH', headers);
    expect(authorizedGet.statusCode).toBe(plainGet.statusCode);
    expect(authorizedGet.json()).toEqual(plainGet.json());
  });

  it('[AC-RIE-35] todo error usa {error:{code,message}} en español', async () => {
    const harness = await openApp({ outcomes: ['ACCEPTED', 'REJECTED', 'UNAVAILABLE'] });
    const invalid = await postTransfer(harness.app, { reference: '' });
    expect(errorOf(invalid)).toEqual({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: expect.stringMatching(/^Solicitud inválida: /),
    });

    const missing = await harness.app.inject({ method: 'GET', url: '/no-existe' });
    expect(errorOf(missing)).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Recurso no encontrado.',
    });

    const wrongMethod = await harness.app.inject({ method: 'DELETE', url: '/health' });
    expect(errorOf(wrongMethod)).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Recurso no encontrado.',
    });

    const notJson = await harness.app.inject({
      method: 'POST',
      url: '/rail/transfers',
      headers: { 'content-type': 'application/json' },
      payload: '{',
    });
    expect(errorOf(notJson)).toEqual({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: expect.stringMatching(/^Solicitud inválida: /),
    });

    await postTransfer(harness.app, transfer('TRX-A'));
    const conflict = await postTransfer(harness.app, transfer('TRX-A', '11.00'));
    expect(errorOf(conflict)).toEqual({
      statusCode: 409,
      code: 'REFERENCE_CONFLICT',
      message: 'La referencia ya existe con datos distintos.',
    });

    const rejected = await postTransfer(harness.app, transfer('TRX-B'));
    expect(errorOf(rejected)).toEqual({
      statusCode: 422,
      code: 'REJECTED',
      message: 'El banco rechazó la operación (REJECTED_BY_BANK).',
    });

    const unavailable = await postTransfer(harness.app, transfer('TRX-C'));
    expect(errorOf(unavailable)).toEqual({
      statusCode: 503,
      code: 'UNAVAILABLE',
      message: 'El banco no está disponible. Reintenta más tarde.',
    });
  });

  it('[AC-RIE-35] un fallo inesperado responde 500 INTERNAL_ERROR con cuerpo genérico', async () => {
    const harness = await openApp({
      outcomes: ['ACCEPTED'],
      ledger: new ExplosiveLedger(),
    });
    const response = await postTransfer(harness.app, transfer('TRX-BOOM'));
    expect(errorOf(response)).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Error interno del servidor.',
    });
    expect(response.body).not.toContain('detalle-interno-no-visible');
    expect(harness.logs.join('\n')).toContain('detalle-interno-no-visible');
  });

  it('[AC-RIE-37] los logs tienen los eventos del riel y no datos sensibles', async () => {
    const from = 'ACC-SECRET-FROM';
    const to = 'EXT-SECRET-TO';
    const amount = '98765.43';
    const token = 'Bearer super-secret-token';
    const cookie = 'session=super-secret-cookie';
    const harness = await openApp({
      outcomes: ['TIMEOUT'],
      timeoutProcessed: [true],
      timeoutDelayMs: 20,
    });

    const response = await postTransfer(
      harness.app,
      { reference: 'TRX-LOG', from, to, amount },
      { authorization: token, cookie, 'x-request-id': 'corr-1' },
    );
    expect(response.statusCode).toBe(200);

    const events = harness.logs.map((line) => JSON.parse(line) as LogLine);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'rail.request',
          reqId: 'corr-1',
          method: 'POST',
          url: '/rail/transfers',
        }),
        expect.objectContaining({
          event: 'rail.outcome_chosen',
          reqId: 'corr-1',
          reference: 'TRX-LOG',
          kind: 'TRANSFER',
          outcome: 'TIMEOUT',
        }),
        expect.objectContaining({
          event: 'rail.timeout',
          reqId: 'corr-1',
          reference: 'TRX-LOG',
          kind: 'TRANSFER',
          processed: true,
          delayMs: 20,
        }),
        expect.objectContaining({
          event: 'rail.response',
          reqId: 'corr-1',
          statusCode: 200,
        }),
      ]),
    );
    expect(
      events.some((line) => line.event === 'rail.response' && line.responseTimeMs !== undefined),
    ).toBe(true);

    const withoutId = await harness.app.inject({ method: 'GET', url: '/health' });
    expect(withoutId.statusCode).toBe(200);
    const generated = harness.logs
      .map((line) => JSON.parse(line) as LogLine)
      .filter((line) => line.url === '/health' && line.event === 'rail.request');
    expect(generated[0]?.reqId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    const serialized = harness.logs.join('\n');
    expect(serialized).not.toContain(token);
    expect(serialized).not.toContain(cookie);
    expect(serialized).not.toContain('super-secret-token');
    expect(serialized).not.toContain('super-secret-cookie');
    expect(serialized).not.toContain(from);
    expect(serialized).not.toContain(to);
    expect(serialized).not.toContain(amount);
    expect(serialized.toLowerCase()).not.toContain('authorization');
    expect(serialized.toLowerCase()).not.toContain('cookie');
  });
});

interface LogLine {
  event?: string;
  reqId?: string;
  method?: string;
  url?: string;
  reference?: string;
  kind?: string;
  outcome?: string;
  processed?: boolean;
  delayMs?: number;
  statusCode?: number;
  responseTimeMs?: number;
}

class ExplosiveLedger implements Ledger {
  find(): Promise<BankOperation | undefined> {
    return Promise.resolve(undefined);
  }

  findAcceptedReversalOf(): Promise<BankOperation | undefined> {
    return Promise.resolve(undefined);
  }

  append(): Promise<void> {
    return Promise.reject(new Error('detalle-interno-no-visible'));
  }
}

async function openApp(options?: Parameters<typeof buildTestApp>[0]): Promise<TestApp> {
  const harness = await buildTestApp(options);
  open.push(harness);
  return harness;
}

function transfer(reference: string, amount = '10.00') {
  return { reference, from: 'ACC-001', to: 'EXT-0001', amount };
}

function postTransfer(app: FastifyInstance, payload: unknown, headers?: Record<string, string>) {
  return app.inject({
    method: 'POST',
    url: '/rail/transfers',
    headers: { 'content-type': 'application/json', ...headers },
    payload: payload as Record<string, unknown> | string,
  });
}

function getTransfer(app: FastifyInstance, reference: string, headers?: Record<string, string>) {
  return app.inject({
    method: 'GET',
    url: `/rail/transfers/${encodeURIComponent(reference)}`,
    headers,
  });
}

function errorOf(response: { statusCode: number; json: () => unknown }): {
  statusCode: number;
  code: string;
  message: unknown;
} {
  const body = response.json() as { error?: { code?: string; message?: string } };
  return {
    statusCode: response.statusCode,
    code: body.error?.code ?? '',
    message: body.error?.message,
  };
}
