// adapter: out — @node-rs/argon2 (Argon2id)
import { hash, verify } from '@node-rs/argon2';
import type { PasswordHasher } from '../../../application/ports/password-hasher.js';

// `Algorithm` es un `const enum` ambiente en el .d.ts del paquete y `verbatimModuleSyntax`
// (tsconfig.base.json) impide importarlo (TS2748): se usa su valor numérico, Algorithm.Argon2id = 2.
const ARGON2_OPTIONS = {
  algorithm: 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export class Argon2PasswordHasher implements PasswordHasher {
  hash(plain: string): Promise<string> {
    return hash(plain, ARGON2_OPTIONS);
  }

  // Un hash inválido o que no coincide devuelve false; nunca lanza.
  async verify(digest: string, plain: string): Promise<boolean> {
    try {
      return await verify(digest, plain, ARGON2_OPTIONS);
    } catch {
      return false;
    }
  }
}
