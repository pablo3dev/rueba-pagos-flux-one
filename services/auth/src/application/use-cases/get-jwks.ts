import type { PublicJwk } from '../../domain/signing-key.js';
import type { TokenIssuer } from '../ports/token-issuer.js';

interface GetJwksDeps {
  tokenIssuer: TokenIssuer;
}

export class GetJwks {
  constructor(private readonly deps: GetJwksDeps) {}

  // Solo lectura (naturalmente idempotente).
  execute(): { keys: PublicJwk[] } {
    return this.deps.tokenIssuer.getJwks();
  }
}
