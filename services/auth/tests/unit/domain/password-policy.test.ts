import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../../src/domain/errors.js';
import { assertValidPassword } from '../../../src/domain/password-policy.js';

describe('assertValidPassword', () => {
  it('[AC-AUT-04] acepta 12 caracteres (límite inferior)', () => {
    expect(() => assertValidPassword('a'.repeat(12))).not.toThrow();
  });

  it('[AC-AUT-04] acepta 128 caracteres (límite superior)', () => {
    expect(() => assertValidPassword('a'.repeat(128))).not.toThrow();
  });

  it('[AC-AUT-04] rechaza 11 caracteres', () => {
    expect(() => assertValidPassword('a'.repeat(11))).toThrow(ValidationError);
  });

  it('[AC-AUT-04] rechaza 129 caracteres', () => {
    expect(() => assertValidPassword('a'.repeat(129))).toThrow(ValidationError);
  });

  it('[AC-AUT-04] rechaza la cadena vacía', () => {
    expect(() => assertValidPassword('')).toThrow(ValidationError);
  });

  it('[AC-AUT-04] cuenta caracteres (code points) y no bytes ni unidades UTF-16', () => {
    // 12 emojis = 12 code points (24 unidades UTF-16, 48 bytes UTF-8): válida.
    expect(() => assertValidPassword('😀'.repeat(12))).not.toThrow();
    // 128 emojis = límite superior; 129 lo excede.
    expect(() => assertValidPassword('😀'.repeat(128))).not.toThrow();
    expect(() => assertValidPassword('😀'.repeat(129))).toThrow(ValidationError);
    // 11 emojis = 11 code points aunque ocupen 22 unidades UTF-16: rechazada.
    expect(() => assertValidPassword('😀'.repeat(11))).toThrow(ValidationError);
  });

  it('[AC-AUT-04] no hace trim: los espacios cuentan como caracteres', () => {
    expect(() => assertValidPassword(' '.repeat(12))).not.toThrow();
  });
});
