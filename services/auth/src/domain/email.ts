import { ValidationError } from './errors.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 254;

// Normaliza (trim + minúsculas) y valida longitud (<= 254) y forma `local@dominio` sobre el valor normalizado.
export function parseEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  if (email.length > EMAIL_MAX_LENGTH) {
    throw new ValidationError(`email must be at most ${EMAIL_MAX_LENGTH} characters`);
  }
  if (!EMAIL_PATTERN.test(email)) {
    throw new ValidationError('email is not valid');
  }
  return email;
}
