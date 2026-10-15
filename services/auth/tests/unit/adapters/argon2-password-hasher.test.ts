import { describe, expect, it } from 'vitest';
import { Argon2PasswordHasher } from '../../../src/adapters/outbound/crypto/argon2-password-hasher.js';

describe('Argon2PasswordHasher', () => {
  const hasher = new Argon2PasswordHasher();

  it('[AC-AUT-01] genera una cadena PHC Argon2id con m=19456, t=2, p=1', async () => {
    const digest = await hasher.hash('una-clave-segura-123');

    expect(digest.startsWith('$argon2id$v=19$m=19456,t=2,p=1$')).toBe(true);
    expect(digest).not.toContain('una-clave-segura-123');
  });

  it('[AC-AUT-01] genera hashes distintos para la misma contraseña (sal aleatoria)', async () => {
    const [a, b] = await Promise.all([
      hasher.hash('una-clave-segura-123'),
      hasher.hash('una-clave-segura-123'),
    ]);

    expect(a).not.toBe(b);
  });

  it('[AC-AUT-01] verify devuelve true con la contraseña correcta', async () => {
    const digest = await hasher.hash('una-clave-segura-123');

    await expect(hasher.verify(digest, 'una-clave-segura-123')).resolves.toBe(true);
  });

  it('[AC-AUT-01] verify devuelve false con una contraseña incorrecta', async () => {
    const digest = await hasher.hash('una-clave-segura-123');

    await expect(hasher.verify(digest, 'otra-clave-distinta-1')).resolves.toBe(false);
  });

  it('[AC-AUT-01] verify devuelve false (no lanza) con un hash inválido', async () => {
    await expect(hasher.verify('no-es-un-hash', 'una-clave-segura-123')).resolves.toBe(false);
    await expect(hasher.verify('', 'una-clave-segura-123')).resolves.toBe(false);
  });
});
