import { ValidationError } from './errors.js';

const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;

// Longitud en caracteres (code points), no bytes. Sin trim ni otras reglas de composición.
export function assertValidPassword(plain: string): void {
  const length = [...plain].length;
  if (length < PASSWORD_MIN_LENGTH || length > PASSWORD_MAX_LENGTH) {
    throw new ValidationError(
      `password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`,
    );
  }
}
