import type { SigningKey } from '../../domain/signing-key.js';
import type { SigningKeyGenerator } from '../ports/signing-key-generator.js';
import type { SigningKeyRepository } from '../ports/signing-key-repository.js';

interface EnsureSigningKeyDeps {
  signingKeys: SigningKeyRepository;
  generator: SigningKeyGenerator;
}

export class EnsureSigningKey {
  constructor(private readonly deps: EnsureSigningKeyDeps) {}

  // Idempotente: solo genera si no hay llave activa y `insertIfNoActive` ignora la inserción si otra
  // instancia ganó la carrera; el resultado se relee con `listAll`.
  async execute(): Promise<SigningKey[]> {
    const { signingKeys, generator } = this.deps;
    if ((await signingKeys.findActive()) === null) {
      await signingKeys.insertIfNoActive(await generator.generate());
    }
    return signingKeys.listAll();
  }
}
