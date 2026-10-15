import { InvalidAmountError } from './errors.js';

export type Money = bigint;

export const MAX_AMOUNT_CENTS = 999999999999999999n;

const AMOUNT_PATTERN = /^(0|[1-9][0-9]{0,15})(\.[0-9]{1,2})?$/;
const DB_NUMERIC = /^[0-9]+\.[0-9]{2}$/;

export function parseAmount(raw: unknown): Money {
  if (typeof raw !== 'string' || !AMOUNT_PATTERN.test(raw)) throw new InvalidAmountError();
  const cents = toCents(raw);
  if (cents <= 0n || cents > MAX_AMOUNT_CENTS) throw new InvalidAmountError();
  return cents;
}

export function formatMoney(amount: Money): string {
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const whole = abs / 100n;
  const frac = (abs % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole.toString()}.${frac}`;
}

export function moneyFromDb(text: string): Money {
  if (!DB_NUMERIC.test(text)) throw new Error('numeric de base de datos inválido');
  return toCents(text);
}

function toCents(text: string): Money {
  const [whole, frac = ''] = text.split('.');
  const padded = (frac + '00').slice(0, 2);
  return BigInt(whole) * 100n + BigInt(padded);
}
