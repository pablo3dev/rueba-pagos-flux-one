import type { Credentials, FieldErrors, TransferDraft } from './types';

export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AMOUNT_PATTERN = /^(0|[1-9][0-9]{0,15})(\.[0-9]{1,2})?$/;
const EXTERNAL_ACCOUNT_PATTERN = /^[A-Z0-9-]{6,34}$/;
const MAX_CENTS = '999999999999999999';

export function isValidAmount(raw: string): boolean {
  const value = raw.trim();
  if (!AMOUNT_PATTERN.test(value)) return false;
  const [whole, frac = ''] = value.split('.');
  const cents = `${whole}${frac.padEnd(2, '0')}`.padStart(MAX_CENTS.length, '0');
  return cents > '0'.padStart(MAX_CENTS.length, '0') && cents <= MAX_CENTS;
}

export function validateRegistration(input: Credentials): FieldErrors {
  const errors: FieldErrors = {};
  const email = input.email.trim();
  if ([...email].length > EMAIL_MAX_LENGTH) errors.email = 'emailTooLong';
  else if (!EMAIL_PATTERN.test(email)) errors.email = 'emailInvalid';
  const passwordLength = [...input.password].length;
  if (passwordLength < PASSWORD_MIN_LENGTH || passwordLength > PASSWORD_MAX_LENGTH) {
    errors.password = 'passwordLength';
  }
  return errors;
}

export function validateLogin(input: Credentials): FieldErrors {
  const errors: FieldErrors = {};
  if (input.email.trim() === '') errors.email = 'emailRequired';
  if (input.password === '') errors.password = 'passwordRequired';
  return errors;
}

export function validateTransfer(draft: TransferDraft): FieldErrors {
  const errors: FieldErrors = {};
  if (draft.fromAccountId.trim() === '') errors.fromAccountId = 'originRequired';
  if (!isValidAmount(draft.amount)) errors.amount = 'amountInvalid';
  if (draft.type === 'EXTERNAL') {
    const external = draft.toExternalAccount.trim();
    if (!EXTERNAL_ACCOUNT_PATTERN.test(external)) errors.toExternalAccount = 'externalInvalid';
    return errors;
  }
  const destination = draft.toAccountId.trim();
  if (destination === '') errors.toAccountId = 'destinationRequired';
  else if ([...destination].length > 64) errors.toAccountId = 'destinationTooLong';
  else if (destination === draft.fromAccountId) errors.toAccountId = 'destinationSame';
  return errors;
}

export function transferPayload(draft: TransferDraft): string {
  if (draft.type === 'EXTERNAL') {
    return JSON.stringify({
      type: 'EXTERNAL',
      fromAccountId: draft.fromAccountId,
      toExternalAccount: draft.toExternalAccount.trim(),
      amount: draft.amount.trim(),
    });
  }
  return JSON.stringify({
    type: 'INTERNAL',
    fromAccountId: draft.fromAccountId,
    toAccountId: draft.toAccountId.trim(),
    amount: draft.amount.trim(),
  });
}
