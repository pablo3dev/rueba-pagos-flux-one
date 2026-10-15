import { ValidationError } from './errors.js';

const REFERENCE_PATTERN = /^[\x21-\x7E]{1,255}$/;

export function isValidReference(raw: unknown): raw is string {
  return typeof raw === 'string' && REFERENCE_PATTERN.test(raw);
}

export function parseReference(raw: unknown, field = 'reference'): string {
  if (!isValidReference(raw)) {
    throw new ValidationError(
      `${field}: la referencia debe tener de 1 a 255 caracteres ASCII imprimibles.`,
    );
  }
  return raw;
}

export function parseParty(raw: unknown, field: 'from' | 'to'): string {
  if (typeof raw !== 'string' || raw.length < 1 || raw.length > 255) {
    throw new ValidationError(`${field}: debe ser un texto de 1 a 255 caracteres.`);
  }
  return raw;
}
