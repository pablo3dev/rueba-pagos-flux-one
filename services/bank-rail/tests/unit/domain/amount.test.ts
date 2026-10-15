import { describe, expect, it } from 'vitest';
import { formatAmount, parseAmount } from '../../../src/domain/amount.js';
import { ValidationError } from '../../../src/domain/errors.js';

function expectInvalidAmount(raw: unknown, echo: string): void {
  try {
    parseAmount(raw);
    expect.fail('debía lanzar ValidationError');
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    const validation = error as ValidationError;
    expect(validation.name).toBe('ValidationError');
    expect(validation.message).not.toContain(echo);
  }
}

describe('parseAmount', () => {
  it.each([
    ['0', '0'],
    ['0.00', '0.00'],
    ['-1', '-1'],
    ['1.234', '1.234'],
    ['01', '01'],
    ['10000000000000000', '10000000000000000'],
  ])('[AC-RIE-07] rechaza el monto %s', (raw, echo) => {
    expectInvalidAmount(raw, echo);
  });

  it('[AC-RIE-07] rechaza un monto que es número JSON', () => {
    expectInvalidAmount(10, '10');
    expectInvalidAmount(10.5, '10.5');
  });

  it('[AC-RIE-07] acepta el máximo y compara 10 con 10.00 por valor', () => {
    expect(parseAmount('9999999999999999.99')).toBe(999999999999999999n);
    expect(formatAmount(999999999999999999n)).toBe('9999999999999999.99');
    expect(parseAmount('10')).toBe(1000n);
    expect(parseAmount('10.00')).toBe(1000n);
    expect(parseAmount('10')).toBe(parseAmount('10.00'));
    expect(formatAmount(1000n)).toBe('10.00');
    expect(formatAmount(1n)).toBe('0.01');
    expect(formatAmount(150050n)).toBe('1500.50');
  });
});
