import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../../src/domain/errors.js';
import { isValidReference, parseParty, parseReference } from '../../../src/domain/reference.js';

const ASCII_255 = 'A'.repeat(255);
const ASCII_256 = 'A'.repeat(256);

function expectInvalidReference(raw: unknown, echo?: string): void {
  expect(isValidReference(raw)).toBe(false);
  try {
    parseReference(raw);
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

describe('parseReference', () => {
  it('[AC-RIE-07] acepta una referencia de 255 caracteres ASCII imprimibles', () => {
    expect(ASCII_255).toHaveLength(255);
    expect(isValidReference(ASCII_255)).toBe(true);
    expect(parseReference(ASCII_255)).toBe(ASCII_255);
    expect(parseReference('!')).toBe('!');
    expect(parseReference('~')).toBe('~');
  });

  it('[AC-RIE-07] rechaza una referencia de 256 caracteres', () => {
    expect(ASCII_256).toHaveLength(256);
    expectInvalidReference(ASCII_256, ASCII_256);
  });

  it('[AC-RIE-07] rechaza una referencia vacía', () => {
    expectInvalidReference('');
  });

  it('[AC-RIE-07] rechaza una referencia con espacio', () => {
    expectInvalidReference('AB CD', 'AB CD');
  });

  it('[AC-RIE-07] rechaza una referencia que no es ASCII', () => {
    expectInvalidReference('café', 'café');
    expectInvalidReference('á', 'á');
  });

  it('[AC-RIE-07] el mensaje de referencia nombra el campo y no el valor', () => {
    expect(() => parseReference('AB CD', 'originalReference')).toThrow(ValidationError);
    try {
      parseReference('AB CD', 'originalReference');
    } catch (error) {
      const validation = error as ValidationError;
      expect(validation.message.startsWith('originalReference:')).toBe(true);
      expect(validation.message).not.toContain('AB CD');
    }
  });
});

describe('parseParty', () => {
  it('[AC-RIE-07] acepta una parte de 1 a 255 caracteres sin más reglas', () => {
    expect(parseParty('A', 'from')).toBe('A');
    expect(parseParty('á'.repeat(255), 'to')).toHaveLength(255);
    expect(parseParty('ACC 001', 'from')).toBe('ACC 001');
  });

  it.each([
    ['vacía', '', 'from'],
    ['de 256 caracteres', 'B'.repeat(256), 'to'],
  ] as const)('[AC-RIE-07] rechaza una parte %s', (_caso, raw, field) => {
    expect(() => parseParty(raw, field)).toThrow(ValidationError);
  });

  it('[AC-RIE-07] rechaza una parte que no es texto', () => {
    expect(() => parseParty(10, 'from')).toThrow(ValidationError);
    try {
      parseParty(10, 'from');
    } catch (error) {
      const validation = error as ValidationError;
      expect(validation.name).toBe('ValidationError');
      expect(validation.message).not.toContain('10');
    }
  });
});
