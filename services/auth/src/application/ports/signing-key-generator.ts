// port: out — generación de pares de llaves de firma
import type { SigningKey } from '../../domain/signing-key.js';

export interface SigningKeyGenerator {
  generate(): Promise<SigningKey>;
}
