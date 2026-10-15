import { describe, expect, it } from 'vitest';
import { parseEmail } from '../../../src/domain/email.js';
import { ValidationError } from '../../../src/domain/errors.js';

const LOCAL_254 = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(57)}.com`;

describe('parseEmail', () => {
  it('[AC-AUT-01] normaliza con trim y minúsculas', () => {
    expect(parseEmail('  Alice@FluxOne.TEST  ')).toBe('alice@fluxone.test');
  });

  it('[AC-AUT-01] dos escrituras del mismo email producen el mismo identificador', () => {
    expect(parseEmail('BOB@fluxone.test')).toBe(parseEmail(' bob@FLUXONE.test '));
  });

  it('[AC-AUT-04] acepta un email de exactamente 254 caracteres', () => {
    expect(LOCAL_254).toHaveLength(254);
    expect(parseEmail(LOCAL_254)).toBe(LOCAL_254);
  });

  it('[AC-AUT-04] rechaza un email de 255 caracteres', () => {
    const tooLong = `a${LOCAL_254}`;
    expect(tooLong).toHaveLength(255);
    expect(() => parseEmail(tooLong)).toThrow(ValidationError);
  });

  it.each([
    ['vacío', ''],
    ['solo espacios', '   '],
    ['sin arroba', 'alice.fluxone.test'],
    ['sin parte local', '@fluxone.test'],
    ['sin dominio', 'alice@'],
    ['dominio sin punto', 'alice@fluxone'],
    ['espacios internos', 'ali ce@fluxone.test'],
    ['dos arrobas', 'a@b@fluxone.test'],
  ])('[AC-AUT-04] rechaza un email inválido: %s', (_caso, raw) => {
    expect(() => parseEmail(raw)).toThrow(ValidationError);
  });
});
