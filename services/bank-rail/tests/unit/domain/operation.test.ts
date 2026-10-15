import { describe, expect, it } from 'vitest';
import { parseAmount } from '../../../src/domain/amount.js';
import { ValidationError } from '../../../src/domain/errors.js';
import {
  buildOperation,
  isSamePayload,
  parseStoredOperation,
  rejectionCode,
  type BankOperation,
  type RejectionReason,
} from '../../../src/domain/operation.js';
import type { ReversalRequest, TransferRequest } from '../../../src/domain/requests.js';

const recordedAt = new Date('2026-10-15T14:00:00.000Z');

function transferRequest(amount: string, from = 'ACC-001', to = 'EXT-0001'): TransferRequest {
  return {
    kind: 'TRANSFER',
    reference: 'TRX-0001',
    from,
    to,
    amountCents: parseAmount(amount),
  };
}

function reversalRequest(amount: string, originalReference = 'TRX-0001'): ReversalRequest {
  return {
    kind: 'REVERSAL',
    reference: 'REV-0001',
    originalReference,
    amountCents: parseAmount(amount),
  };
}

function omitKeys<T extends object>(value: T, keys: readonly (keyof T)[]): Partial<T> {
  const result: Partial<T> = {};
  for (const entryKey of Object.keys(value) as (keyof T)[]) {
    if (!keys.includes(entryKey)) {
      result[entryKey] = value[entryKey];
    }
  }
  return result;
}

function expectInvalidStored(raw: unknown, echo?: string): void {
  try {
    parseStoredOperation(raw);
    expect.fail('debía lanzar ValidationError');
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    const validation = error as ValidationError;
    expect(validation.name).toBe('ValidationError');
    if (echo !== undefined) {
      expect(validation.message).not.toContain(echo);
    }
  }
}

describe('isSamePayload', () => {
  const existingTransfer: BankOperation = {
    reference: 'TRX-0001',
    kind: 'TRANSFER',
    from: 'ACC-001',
    to: 'EXT-0001',
    amount: '10',
    status: 'ACCEPTED',
    recordedAt: recordedAt.toISOString(),
  };

  it('[AC-RIE-09] el mismo from, to y monto por valor es el mismo payload', () => {
    expect(isSamePayload(existingTransfer, transferRequest('10.00'))).toBe(true);
    expect(isSamePayload(existingTransfer, transferRequest('10'))).toBe(true);
    expect(isSamePayload({ ...existingTransfer, amount: '10.00' }, transferRequest('10'))).toBe(
      true,
    );
  });

  it('[AC-RIE-09] un from, to o monto distinto es otro payload', () => {
    expect(isSamePayload(existingTransfer, transferRequest('10.00', 'ACC-002'))).toBe(false);
    expect(isSamePayload(existingTransfer, transferRequest('10.00', 'ACC-001', 'EXT-0002'))).toBe(
      false,
    );
    expect(isSamePayload(existingTransfer, transferRequest('10.01'))).toBe(false);
  });

  it('[AC-RIE-09] otro tipo de operación es otro payload', () => {
    expect(isSamePayload(existingTransfer, reversalRequest('10.00'))).toBe(false);
    const existingReversal: BankOperation = {
      reference: 'REV-0001',
      kind: 'REVERSAL',
      originalReference: 'TRX-0001',
      amount: '10.00',
      status: 'REJECTED',
      reason: 'AMOUNT_MISMATCH',
      recordedAt: recordedAt.toISOString(),
    };
    expect(isSamePayload(existingReversal, transferRequest('10.00'))).toBe(false);
  });

  it('[AC-RIE-09] un reverso compara originalReference y monto por valor', () => {
    const existingReversal: BankOperation = {
      reference: 'REV-0001',
      kind: 'REVERSAL',
      originalReference: 'TRX-0001',
      amount: '10',
      status: 'ACCEPTED',
      recordedAt: recordedAt.toISOString(),
    };
    expect(isSamePayload(existingReversal, reversalRequest('10.00'))).toBe(true);
    expect(isSamePayload(existingReversal, reversalRequest('10.00', 'TRX-9999'))).toBe(false);
    expect(isSamePayload(existingReversal, reversalRequest('11.00'))).toBe(false);
  });
});

describe('buildOperation', () => {
  it('[AC-RIE-24] ordena las claves y omite las ausentes', () => {
    const accepted = buildOperation(transferRequest('10'), { status: 'ACCEPTED' }, recordedAt);
    expect(Object.keys(accepted)).toEqual([
      'reference',
      'kind',
      'from',
      'to',
      'amount',
      'status',
      'recordedAt',
    ]);
    expect(accepted.amount).toBe('10.00');
    expect(accepted.recordedAt).toBe('2026-10-15T14:00:00.000Z');

    const rejected = buildOperation(
      transferRequest('20.5'),
      { status: 'REJECTED', reason: 'REJECTED_BY_BANK' },
      recordedAt,
    );
    expect(Object.keys(rejected)).toEqual([
      'reference',
      'kind',
      'from',
      'to',
      'amount',
      'status',
      'reason',
      'recordedAt',
    ]);
    expect(rejected.amount).toBe('20.50');

    const reversal = buildOperation(
      reversalRequest('10.00'),
      { status: 'REJECTED', reason: 'ORIGINAL_NOT_FOUND' },
      recordedAt,
    );
    expect(Object.keys(reversal)).toEqual([
      'reference',
      'kind',
      'originalReference',
      'amount',
      'status',
      'reason',
      'recordedAt',
    ]);
    expect(reversal).not.toHaveProperty('from');
    expect(reversal).not.toHaveProperty('to');
  });
});

describe('rejectionCode', () => {
  it('[AC-RIE-01] traduce REJECTED_BY_BANK a REJECTED', () => {
    expect(rejectionCode('REJECTED_BY_BANK')).toBe('REJECTED');
  });

  it('[AC-RIE-17][AC-RIE-18][AC-RIE-19][AC-RIE-20] conserva el motivo de la regla', () => {
    const reasons: RejectionReason[] = [
      'ORIGINAL_NOT_FOUND',
      'ORIGINAL_NOT_ACCEPTED',
      'AMOUNT_MISMATCH',
      'ALREADY_REVERSED',
    ];
    for (const reason of reasons) {
      expect(rejectionCode(reason)).toBe(reason);
    }
  });
});

describe('parseStoredOperation', () => {
  const acceptedTransfer = {
    reference: 'TRX-0001',
    kind: 'TRANSFER',
    from: 'ACC-001',
    to: 'EXT-0001',
    amount: '1500.50',
    status: 'ACCEPTED',
    recordedAt: '2026-10-15T14:00:00.000Z',
  };

  it('[AC-RIE-24] acepta las líneas coherentes del libro', () => {
    expect(parseStoredOperation(acceptedTransfer)).toEqual(acceptedTransfer);
    expect(Object.keys(parseStoredOperation(acceptedTransfer))).toEqual([
      'reference',
      'kind',
      'from',
      'to',
      'amount',
      'status',
      'recordedAt',
    ]);
    const rejectedTransfer = {
      ...acceptedTransfer,
      reference: 'TRX-0002',
      amount: '20.00',
      status: 'REJECTED',
      reason: 'REJECTED_BY_BANK',
      recordedAt: '2026-10-15T14:00:05.000Z',
    };
    expect(Object.keys(parseStoredOperation(rejectedTransfer))).toEqual([
      'reference',
      'kind',
      'from',
      'to',
      'amount',
      'status',
      'reason',
      'recordedAt',
    ]);
    const acceptedReversal = {
      reference: 'REV-0001',
      kind: 'REVERSAL',
      originalReference: 'TRX-0001',
      amount: '1500.50',
      status: 'ACCEPTED',
      recordedAt: '2026-10-15T14:01:00.000Z',
    };
    expect(parseStoredOperation(acceptedReversal)).toEqual(acceptedReversal);
  });

  it('[AC-RIE-28] rechaza campos faltantes', () => {
    expectInvalidStored(omitKeys(acceptedTransfer, ['reference']));
    expectInvalidStored(omitKeys(acceptedTransfer, ['recordedAt']));
    expectInvalidStored(omitKeys(acceptedTransfer, ['from']));
    expectInvalidStored({
      reference: 'REV-0002',
      kind: 'REVERSAL',
      originalReference: 'TRX-0002',
      amount: '20.00',
      status: 'REJECTED',
      recordedAt: '2026-10-15T14:01:10.000Z',
    });
    expectInvalidStored({});
  });

  it('[AC-RIE-28] rechaza un motivo en una operación aceptada', () => {
    expectInvalidStored({ ...acceptedTransfer, reason: 'REJECTED_BY_BANK' }, 'REJECTED_BY_BANK');
  });

  it('[AC-RIE-28] rechaza incoherencia entre el tipo y sus campos', () => {
    expectInvalidStored(
      { ...omitKeys(acceptedTransfer, ['from', 'to']), originalReference: 'TRX-0009' },
      'TRX-0009',
    );
    expectInvalidStored({
      reference: 'REV-0001',
      kind: 'REVERSAL',
      from: 'ACC-001',
      to: 'EXT-0001',
      amount: '1500.50',
      status: 'ACCEPTED',
      recordedAt: '2026-10-15T14:01:00.000Z',
    });
    expectInvalidStored({
      reference: 'REV-0001',
      kind: 'REVERSAL',
      originalReference: 'TRX-0001',
      from: 'ACC-001',
      amount: '1500.50',
      status: 'ACCEPTED',
      recordedAt: '2026-10-15T14:01:00.000Z',
    });
  });

  it('[AC-RIE-28] rechaza un monto sin dos decimales y una referencia inválida', () => {
    expectInvalidStored({ ...acceptedTransfer, amount: '10' }, '10');
    expectInvalidStored({ ...acceptedTransfer, reference: 'AB CD' }, 'AB CD');
  });
});
