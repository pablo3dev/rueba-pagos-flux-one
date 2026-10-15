import { describe, expect, it } from 'vitest';
import {
  isValidAmount,
  validateLogin,
  validateRegistration,
  validateTransfer,
} from '../../src/domain/validation';

describe('validation', () => {
  it('blocks passwords of 11 and 129 characters and accepts 12 and 128', () => {
    expect(validateRegistration({ email: 'a@b.co', password: 'a'.repeat(11) }).password).toBe(
      'passwordLength',
    );
    expect(validateRegistration({ email: 'a@b.co', password: 'a'.repeat(129) }).password).toBe(
      'passwordLength',
    );
    expect(validateRegistration({ email: 'a@b.co', password: 'a'.repeat(12) })).toEqual({});
    expect(validateRegistration({ email: 'a@b.co', password: 'a'.repeat(128) })).toEqual({});
  });

  it('rejects an empty login before any request would be sent', () => {
    expect(validateLogin({ email: ' ', password: '' })).toEqual({
      email: 'emailRequired',
      password: 'passwordRequired',
    });
  });

  it('accepts transfer amounts that keep two-decimal precision and rejects the rest', () => {
    for (const amount of ['100', '100.5', '100.50', '0.01', '9999999999999999.99']) {
      expect(isValidAmount(amount)).toBe(true);
    }
    for (const amount of ['0', '0.00', '-5', '1.234', 'abc', '', '10000000000000000']) {
      expect(isValidAmount(amount)).toBe(false);
    }
  });

  it('requires a distinct destination and a valid external account', () => {
    expect(
      validateTransfer({
        type: 'INTERNAL',
        fromAccountId: 'ACC-001',
        toAccountId: 'ACC-001',
        toExternalAccount: '',
        amount: '10',
      }).toAccountId,
    ).toBe('destinationSame');
    expect(
      validateTransfer({
        type: 'EXTERNAL',
        fromAccountId: 'ACC-001',
        toAccountId: '',
        toExternalAccount: 'ab',
        amount: '10',
      }).toExternalAccount,
    ).toBe('externalInvalid');
    expect(
      validateTransfer({
        type: 'EXTERNAL',
        fromAccountId: 'ACC-001',
        toAccountId: '',
        toExternalAccount: 'BANK-01',
        amount: '10.50',
      }),
    ).toEqual({});
  });
});
