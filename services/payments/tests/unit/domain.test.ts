import { describe, expect, it } from 'vitest';
import { credit, debit, type Account } from '../../src/domain/account.js';
import {
  applyQueryOutcome,
  applySubmitOutcome,
  backoffSeconds,
  createExternalTransfer,
  nextRailAction,
  parseExternalAccount,
} from '../../src/domain/external-transfer.js';
import { canonicalJson, computeRequestHash, parseIdempotencyKey } from '../../src/domain/idempotency.js';
import { formatMoney, parseAmount } from '../../src/domain/money.js';
import { eventsForNewTransfer } from '../../src/domain/outbox-event.js';
import { planInternalReversal } from '../../src/domain/reversal.js';
import { executeInternalTransfer } from '../../src/domain/transfer.js';
import {
  IdempotencyKeyRequiredError,
  InvalidAmountError,
  InvalidTransferTransitionError,
  ReversalInsufficientFundsError,
  SameAccountError,
} from '../../src/domain/errors.js';

const now = new Date('2026-10-15T14:00:00.000Z');

function account(id: string, owner: string, cents: bigint): Account {
  return {
    id,
    ownerUserId: owner,
    currency: 'COP',
    balance: cents,
    createdAt: now,
    updatedAt: now,
  };
}

describe('dinero', () => {
  it('acepta 0.01 y el máximo y rechaza cero, negativos y números', () => {
    expect(parseAmount('0.01')).toBe(1n);
    expect(parseAmount('9999999999999999.99')).toBe(999999999999999999n);
    expect(formatMoney(100n)).toBe('1.00');
    expect(formatMoney(100000000n)).toBe('1000000.00');
    for (const raw of ['0', '-1', '1.234', '01', 10, null]) {
      expect(() => parseAmount(raw)).toThrow(InvalidAmountError);
    }
  });
});

describe('cuentas y transferencia interna', () => {
  it('debita hasta cero y no deja saldo negativo', () => {
    const origin = account('ACC-001', 'alice', 150n);
    expect(debit(origin, 150n, now).balance).toBe(0n);
    expect(() => debit(origin, 151n, now)).toThrow();
    const destination = account('ACC-002', 'bob', 50n);
    const done = executeInternalTransfer({
      id: '5b0b5f55-7f45-4b9a-bf0a-0a0f2f2a1d11',
      ownerUserId: 'alice',
      from: origin,
      to: destination,
      amount: 100n,
      correlationId: null,
      now,
    });
    expect(done.transfer.status).toBe('COMPLETED');
    expect(done.from.balance + done.to.balance).toBe(origin.balance + destination.balance);
    const failed = executeInternalTransfer({
      id: '5b0b5f55-7f45-4b9a-bf0a-0a0f2f2a1d12',
      ownerUserId: 'carol',
      from: account('ACC-003', 'carol', 0n),
      to: destination,
      amount: 1n,
      correlationId: null,
      now,
    });
    expect(failed.transfer.status).toBe('FAILED');
    expect(failed.transfer.failureReason).toBe('INSUFFICIENT_FUNDS');
    expect(failed.from.balance).toBe(0n);
    expect(() =>
      executeInternalTransfer({
        id: '5b0b5f55-7f45-4b9a-bf0a-0a0f2f2a1d13',
        ownerUserId: 'alice',
        from: origin,
        to: origin,
        amount: 1n,
        correlationId: null,
        now,
      }),
    ).toThrow(SameAccountError);
  });
});

describe('transferencia externa', () => {
  it('retiene fondos, reintenta y concilia sin asumir éxito', () => {
    expect(parseExternalAccount('EXT-0001')).toBe('EXT-0001');
    expect(() => parseExternalAccount('abc')).toThrow();
    expect(backoffSeconds(0)).toBe(1);
    expect(backoffSeconds(1)).toBe(2);
    expect(backoffSeconds(5)).toBe(30);
    const from = account('ACC-001', 'alice', 100n);
    const pending = createExternalTransfer({
      id: '5b0b5f55-7f45-4b9a-bf0a-0a0f2f2a1d11',
      ownerUserId: 'alice',
      from,
      toExternalAccount: 'EXT-0001',
      amount: 100n,
      correlationId: 'corr',
      now,
    });
    expect(pending.transfer.status).toBe('PENDING');
    expect(pending.from.balance).toBe(0n);
    expect(nextRailAction(pending.transfer)).toBe('SUBMIT');
    const unknown = applySubmitOutcome(pending.transfer, 'TIMEOUT', now);
    expect(unknown.next.status).toBe('UNKNOWN');
    expect(unknown.refund).toBe(false);
    const accepted = applyQueryOutcome(unknown.next, 'ACCEPTED', now);
    expect(accepted.next.status).toBe('COMPLETED');
    expect(accepted.refund).toBe(false);
    let retry = pending.transfer;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const step = applySubmitOutcome(retry, 'UNAVAILABLE', now);
      expect(step.next.status).toBe('PENDING');
      expect(step.refund).toBe(false);
      retry = step.next;
    }
    const exhausted = applySubmitOutcome(retry, 'UNAVAILABLE', now);
    expect(exhausted.next.status).toBe('FAILED');
    expect(exhausted.next.failureReason).toBe('RAIL_UNAVAILABLE');
    expect(exhausted.refund).toBe(true);
    expect(() => applySubmitOutcome(exhausted.next, 'ACCEPTED', now)).toThrow(InvalidTransferTransitionError);
  });
});

describe('reverso interno', () => {
  it('devuelve el monto una sola vez cuando el destino alcanza', () => {
    const from = account('ACC-001', 'alice', 0n);
    const to = account('ACC-002', 'bob', 100n);
    const transfer = executeInternalTransfer({
      id: '5b0b5f55-7f45-4b9a-bf0a-0a0f2f2a1d11',
      ownerUserId: 'alice',
      from: account('ACC-001', 'alice', 100n),
      to: account('ACC-002', 'bob', 0n),
      amount: 100n,
      correlationId: null,
      now,
    }).transfer;
    const plan = planInternalReversal({
      reversalId: '6b0b5f55-7f45-4b9a-bf0a-0a0f2f2a1d11',
      transfer,
      from,
      to,
      requestedByUserId: 'alice',
      correlationId: null,
      now,
    });
    expect(plan.transfer.status).toBe('REVERSED');
    expect(plan.reversal.status).toBe('COMPLETED');
    expect(plan.from.balance).toBe(100n);
    expect(plan.to.balance).toBe(0n);
    expect(() =>
      planInternalReversal({
        reversalId: '6b0b5f55-7f45-4b9a-bf0a-0a0f2f2a1d12',
        transfer,
        from,
        to: account('ACC-002', 'bob', 99n),
        requestedByUserId: 'alice',
        correlationId: null,
        now,
      }),
    ).toThrow(ReversalInsufficientFundsError);
    expect(credit(from, 1n, now).balance).toBe(1n);
  });
});

describe('idempotencia y outbox', () => {
  it('exige la clave y produce la misma huella con claves en distinto orden', () => {
    expect(parseIdempotencyKey('abc-1')).toBe('abc-1');
    expect(() => parseIdempotencyKey('')).toThrow(IdempotencyKeyRequiredError);
    expect(() => parseIdempotencyKey('a b')).toThrow(IdempotencyKeyRequiredError);
    const left = computeRequestHash('CREATE_TRANSFER', { b: 1, a: { d: 2, c: 3 } });
    const right = computeRequestHash('CREATE_TRANSFER', { a: { c: 3, d: 2 }, b: 1 });
    expect(left).toBe(right);
    expect(left).toMatch(/^[0-9a-f]{64}$/);
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(computeRequestHash('OTRA', { a: 1 })).not.toBe(computeRequestHash('CREATE_TRANSFER', { a: 1 }));
  });

  it('emite created y completed al nacer una interna completada', () => {
    const transfer = executeInternalTransfer({
      id: '5b0b5f55-7f45-4b9a-bf0a-0a0f2f2a1d11',
      ownerUserId: '11111111-1111-4111-8111-111111111111',
      from: account('ACC-001', '11111111-1111-4111-8111-111111111111', 100n),
      to: account('ACC-002', '22222222-2222-4222-8222-222222222222', 0n),
      amount: 10n,
      correlationId: 'req-1',
      now,
    }).transfer;
    const events = eventsForNewTransfer({
      transfer,
      visibleToUserIds: [transfer.ownerUserId, '22222222-2222-4222-8222-222222222222'],
      actorUserId: transfer.ownerUserId,
      createdEventId: '7b0b5f55-7f45-4b9a-bf0a-0a0f2f2a1d11',
      statusEventId: '7b0b5f55-7f45-4b9a-bf0a-0a0f2f2a1d12',
    });
    expect(events.map((event) => event.eventType)).toEqual(['transfer.created', 'transfer.completed']);
    expect(events[0]?.payload.data.amount).toBe('0.10');
  });
});
