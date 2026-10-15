// port: out — persistencia de llaves de firma
import type { SigningKey } from '../../domain/signing-key.js';

export interface SigningKeyRepository {
  findActive(): Promise<SigningKey | null>;
  insertIfNoActive(key: SigningKey): Promise<void>; // INSERT ... ON CONFLICT DO NOTHING
  listAll(): Promise<SigningKey[]>;
}
