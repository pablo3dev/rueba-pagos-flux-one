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

describe('composición de puertos', () => {
  it('[AC-RIE-33] OutcomePicker, Delay y Ledger sustitutos controlan la respuesta sin esperas reales', async () => {
    const ledger = new MemoryLedger();
    const started = Date.now();
    const harness = await buildTestApp({
      outcomes: ['ACCEPTED', 'REJECTED', 'UNAVAILABLE', 'TIMEOUT'],
      timeoutProcessed: [true],
      timeoutDelayMs: 60_000,
      ledger,
    });
    open.push(harness);

    const accepted = await post(harness, 'TRX-A');
    const rejected = await post(harness, 'TRX-B');
    const unavailable = await post(harness, 'TRX-C');
    const timeout = await post(harness, 'TRX-D');

    expect(Date.now() - started).toBeLessThan(2000);
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toEqual({ reference: 'TRX-A', status: 'ACCEPTED' });
    expect(rejected.statusCode).toBe(422);
    expect(rejected.json()).toEqual({
      error: {
        code: 'REJECTED',
        message: 'El banco rechazó la operación (REJECTED_BY_BANK).',
      },
    });
    expect(unavailable.statusCode).toBe(503);
    expect(timeout.statusCode).toBe(200);
    expect(harness.picker.pickCalls).toBe(4);
    expect(harness.picker.timeoutCalls).toBe(1);
    expect(harness.delay.waits).toEqual([60_000]);
    expect(ledger.rows.map((row) => row.reference)).toEqual(['TRX-A', 'TRX-B', 'TRX-D']);
    expect(await harness.ledgerLines()).toEqual([]);
  });
});

class MemoryLedger implements Ledger {
  readonly rows: BankOperation[] = [];

  find(reference: string): Promise<BankOperation | undefined> {
    return Promise.resolve(this.rows.find((row) => row.reference === reference));
  }

  findAcceptedReversalOf(originalReference: string): Promise<BankOperation | undefined> {
    return Promise.resolve(
      this.rows.find(
        (row) =>
          row.kind === 'REVERSAL' &&
          row.status === 'ACCEPTED' &&
          row.originalReference === originalReference,
      ),
    );
  }

  append(operation: BankOperation): Promise<void> {
    this.rows.push(operation);
    return Promise.resolve();
  }
}

function post(harness: TestApp, reference: string) {
  return harness.app.inject({
    method: 'POST',
    url: '/rail/transfers',
    headers: { 'content-type': 'application/json' },
    payload: { reference, from: 'ACC-001', to: 'EXT-0001', amount: '10.00' },
  });
}
