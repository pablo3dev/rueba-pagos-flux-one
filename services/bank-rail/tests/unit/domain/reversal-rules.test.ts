import { describe, expect, it } from 'vitest';
import { parseAmount } from '../../../src/domain/amount.js';
import type { BankOperation } from '../../../src/domain/operation.js';
import type { ReversalRequest } from '../../../src/domain/requests.js';
import { decideReversalRejection } from '../../../src/domain/reversal-rules.js';

const recordedAt = '2026-10-15T14:00:00.000Z';

function request(amount: string, originalReference = 'TRX-0001'): ReversalRequest {
  return {
    kind: 'REVERSAL',
    reference: 'REV-0001',
    originalReference,
    amountCents: parseAmount(amount),
  };
}

function transfer(overrides: Partial<BankOperation> = {}): BankOperation {
  return {
    reference: 'TRX-0001',
    kind: 'TRANSFER',
    from: 'ACC-001',
    to: 'EXT-0001',
    amount: '10.00',
    status: 'ACCEPTED',
    recordedAt,
    ...overrides,
  };
}

function acceptedReversal(): BankOperation {
  return {
    reference: 'REV-0000',
    kind: 'REVERSAL',
    originalReference: 'TRX-0001',
    amount: '10.00',
    status: 'ACCEPTED',
    recordedAt,
  };
}

describe('decideReversalRejection', () => {
  it('[AC-RIE-17] devuelve ORIGINAL_NOT_FOUND si la original no existe', () => {
    expect(decideReversalRejection(request('10.00'), undefined, undefined)).toBe(
      'ORIGINAL_NOT_FOUND',
    );
  });

  it('[AC-RIE-18] devuelve ORIGINAL_NOT_ACCEPTED si la original está rechazada', () => {
    expect(
      decideReversalRejection(
        request('10.00'),
        transfer({ status: 'REJECTED', reason: 'REJECTED_BY_BANK' }),
        undefined,
      ),
    ).toBe('ORIGINAL_NOT_ACCEPTED');
  });

  it('[AC-RIE-18] devuelve ORIGINAL_NOT_ACCEPTED si la original es un reverso', () => {
    expect(decideReversalRejection(request('10.00'), acceptedReversal(), undefined)).toBe(
      'ORIGINAL_NOT_ACCEPTED',
    );
  });

  it('[AC-RIE-19] devuelve AMOUNT_MISMATCH si el monto difiere', () => {
    expect(decideReversalRejection(request('10.01'), transfer(), undefined)).toBe(
      'AMOUNT_MISMATCH',
    );
  });

  it('[AC-RIE-20] devuelve ALREADY_REVERSED si ya hay un reverso aceptado', () => {
    expect(decideReversalRejection(request('10.00'), transfer(), acceptedReversal())).toBe(
      'ALREADY_REVERSED',
    );
  });

  it('[AC-RIE-20] un reverso previo rechazado no cuenta', () => {
    expect(decideReversalRejection(request('10'), transfer({ amount: '10.00' }), undefined)).toBe(
      undefined,
    );
  });

  it('[AC-RIE-21] devuelve undefined cuando la original aceptada coincide y no hay reverso', () => {
    expect(decideReversalRejection(request('10.00'), transfer({ amount: '10' }), undefined)).toBe(
      undefined,
    );
  });

  it('[AC-RIE-21] con varias violaciones gana la de menor número del orden fijo', () => {
    expect(decideReversalRejection(request('99.00'), undefined, acceptedReversal())).toBe(
      'ORIGINAL_NOT_FOUND',
    );
    expect(
      decideReversalRejection(
        request('99.00'),
        transfer({ status: 'REJECTED', reason: 'REJECTED_BY_BANK', amount: '10.00' }),
        acceptedReversal(),
      ),
    ).toBe('ORIGINAL_NOT_ACCEPTED');
    expect(
      decideReversalRejection(request('99.00'), acceptedReversal(), acceptedReversal()),
    ).toBe('ORIGINAL_NOT_ACCEPTED');
    expect(decideReversalRejection(request('99.00'), transfer(), acceptedReversal())).toBe(
      'AMOUNT_MISMATCH',
    );
  });
});
