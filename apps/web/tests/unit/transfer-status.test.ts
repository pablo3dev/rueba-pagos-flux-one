import { describe, expect, it } from 'vitest';
import { canReverse, needsLiveStatus, transferStatusKind } from '../../src/domain/transfer-status';
import type { TransferView } from '../../src/domain/types';

function transfer(partial: Partial<TransferView>): TransferView {
  return {
    id: '5b0b5f55-7f45-4b9a-bf0a-0a0f2f2a1d11',
    type: 'EXTERNAL',
    fromAccountId: 'ACC-001',
    toExternalAccount: 'BANK-01',
    amount: '10.00',
    currency: 'COP',
    status: 'COMPLETED',
    createdAt: '2026-10-15T14:00:00.000Z',
    ...partial,
  };
}

describe('transfer status', () => {
  it('treats pending and unknown as still confirming with the bank', () => {
    expect(transferStatusKind(transfer({ status: 'PENDING' }))).toBe('confirming');
    expect(transferStatusKind(transfer({ status: 'UNKNOWN' }))).toBe('confirming');
    expect(needsLiveStatus(transfer({ status: 'PENDING' }))).toBe(true);
    expect(
      needsLiveStatus(transfer({ status: 'FAILED', failureReason: 'INSUFFICIENT_FUNDS' })),
    ).toBe(false);
  });

  it('offers reversal only for a completed transfer that is not already reversing', () => {
    expect(canReverse(transfer({ status: 'COMPLETED' }))).toBe(true);
    expect(canReverse(transfer({ status: 'PENDING' }))).toBe(false);
    expect(canReverse(transfer({ status: 'FAILED', failureReason: 'INSUFFICIENT_FUNDS' }))).toBe(
      false,
    );
    expect(canReverse(transfer({ status: 'REVERSED' }))).toBe(false);
    expect(
      canReverse(transfer({ status: 'COMPLETED', reversal: { id: 'r1', status: 'PENDING' } })),
    ).toBe(false);
    expect(
      canReverse(transfer({ status: 'COMPLETED', reversal: { id: 'r1', status: 'REJECTED' } })),
    ).toBe(true);
  });
});
