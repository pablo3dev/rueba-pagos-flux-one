// adapter: out — node:crypto (token opaco de 256 bits y huella SHA-256)
import { createHash, randomBytes } from 'node:crypto';
import type { OpaqueTokenGenerator } from '../../../application/ports/opaque-token-generator.js';

export class NodeOpaqueTokenGenerator implements OpaqueTokenGenerator {
  generate(): { token: string; tokenHash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, tokenHash: this.hash(token) };
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
