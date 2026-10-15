import { ValidationError } from './errors.js';

const AMOUNT_PATTERN = /^(0|[1-9][0-9]{0,15})(\.[0-9]{1,2})?$/;

export function parseAmount(raw: unknown): bigint {
  if (typeof raw !== 'string' || !AMOUNT_PATTERN.test(raw)) {
    throw new ValidationError(
      'El monto debe ser una cadena decimal mayor que cero, con hasta dos decimales.',
    );
  }
  const [whole = '0', fraction = ''] = raw.split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents <= 0n) {
    throw new ValidationError('El monto debe ser mayor que cero.');
  }
  return cents;
}

export function formatAmount(cents: bigint): string {
  const fraction = (cents % 100n).toString().padStart(2, '0');
  return `${(cents / 100n).toString()}.${fraction}`;
}
