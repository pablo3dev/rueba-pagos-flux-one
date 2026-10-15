import type { TokenIssuer } from '../ports/token-issuer.js';

interface GetProfileDeps {
  tokenIssuer: TokenIssuer;
}

export class GetProfile {
  constructor(private readonly deps: GetProfileDeps) {}

  // Solo lectura (naturalmente idempotente): toma id y email de los claims, sin consultar la DB.
  async execute(input: { accessToken: string }): Promise<{ id: string; email: string }> {
    const { userId, email } = await this.deps.tokenIssuer.verifyAccessToken(input.accessToken);
    return { id: userId, email };
  }
}
