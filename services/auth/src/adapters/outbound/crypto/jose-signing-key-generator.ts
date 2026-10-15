// adapter: out — jose (llaves Ed25519 EdDSA)
import { randomUUID } from 'node:crypto';
import { exportJWK, exportPKCS8, generateKeyPair } from 'jose';
import type { Clock } from '../../../application/ports/clock.js';
import type { SigningKeyGenerator } from '../../../application/ports/signing-key-generator.js';
import type { PublicJwk, SigningKey } from '../../../domain/signing-key.js';

export class JoseSigningKeyGenerator implements SigningKeyGenerator {
  constructor(private readonly clock: Clock) {}

  async generate(): Promise<SigningKey> {
    const { privateKey, publicKey } = await generateKeyPair('EdDSA', {
      crv: 'Ed25519',
      extractable: true,
    });
    const kid = randomUUID();
    const { x } = await exportJWK(publicKey);
    const publicJwk: PublicJwk = {
      kty: 'OKP',
      crv: 'Ed25519',
      x: x as string,
      kid,
      alg: 'EdDSA',
      use: 'sig',
    };
    return {
      kid,
      alg: 'EdDSA',
      publicJwk,
      privateKeyPkcs8: await exportPKCS8(privateKey),
      active: true,
      createdAt: this.clock.now(),
    };
  }
}
