import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../../src/domain/errors.js';
import { parseReversalRequest, parseTransferRequest } from '../../../src/domain/requests.js';

const transfer = {
  reference: 'TRX-0001',
  from: 'ACC-001',
  to: 'EXT-0001',
  amount: '1500.50',
};

const reversal = {
  reference: 'REV-0001',
  originalReference: 'TRX-0001',
  amount: '1500.50',
};

function expectValidation(run: () => unknown, echo?: string): void {
  try {
    run();
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

describe('parseTransferRequest', () => {
  it('[AC-RIE-07] acepta una transferencia con exactamente sus campos', () => {
    expect(parseTransferRequest(transfer)).toEqual({
      kind: 'TRANSFER',
      reference: 'TRX-0001',
      from: 'ACC-001',
      to: 'EXT-0001',
      amountCents: 150050n,
    });
  });

  it.each(['reference', 'from', 'to', 'amount'])(
    '[AC-RIE-07] rechaza una transferencia sin el campo %s',
    (field) => {
      const body: Record<string, string> = { ...transfer };
      delete body[field];
      expectValidation(() => parseTransferRequest(body));
    },
  );

  it('[AC-RIE-07] rechaza una transferencia con un campo adicional', () => {
    expectValidation(
      () => parseTransferRequest({ ...transfer, note: 'VALOR-EXTRA' }),
      'VALOR-EXTRA',
    );
  });

  it('[AC-RIE-07] rechaza una transferencia con un campo de tipo incorrecto', () => {
    expectValidation(() => parseTransferRequest({ ...transfer, amount: 1500.5 }), '1500.5');
    expectValidation(() => parseTransferRequest({ ...transfer, from: 12 }), '12');
    expectValidation(() => parseTransferRequest({ ...transfer, reference: 7 }), '7');
  });

  it.each([
    ['null', null],
    ['arreglo', []],
    ['texto', 'TRX-0001'],
    ['número', 10],
  ])('[AC-RIE-07] rechaza una transferencia que no es un objeto: %s', (_caso, raw) => {
    expectValidation(() => parseTransferRequest(raw));
  });
});

describe('parseReversalRequest', () => {
  it('[AC-RIE-07] acepta un reverso con exactamente sus campos', () => {
    expect(parseReversalRequest(reversal)).toEqual({
      kind: 'REVERSAL',
      reference: 'REV-0001',
      originalReference: 'TRX-0001',
      amountCents: 150050n,
    });
  });

  it.each(['reference', 'originalReference', 'amount'])(
    '[AC-RIE-07] rechaza un reverso sin el campo %s',
    (field) => {
      const body: Record<string, string> = { ...reversal };
      delete body[field];
      expectValidation(() => parseReversalRequest(body));
    },
  );

  it('[AC-RIE-07] rechaza un reverso con un campo adicional', () => {
    expectValidation(
      () => parseReversalRequest({ ...reversal, from: 'CUENTA-OCULTA' }),
      'CUENTA-OCULTA',
    );
  });

  it('[AC-RIE-07] rechaza un reverso con un campo de tipo incorrecto', () => {
    expectValidation(
      () => parseReversalRequest({ ...reversal, originalReference: 99 }),
      '99',
    );
    expectValidation(() => parseReversalRequest({ ...reversal, amount: 20 }), '20');
  });
});
