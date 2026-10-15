import type { Clock } from '../ports/clock.js';
import type { OpaqueTokenGenerator } from '../ports/opaque-token-generator.js';
import type { RefreshTokenRepository } from '../ports/refresh-token-repository.js';

interface LogoutSessionDeps {
  refreshTokens: RefreshTokenRepository;
  tokens: OpaqueTokenGenerator;
  clock: Clock;
}

export class LogoutSession {
  constructor(private readonly deps: LogoutSessionDeps) {}

  // Idempotente por definición: revocar lo ya revocado, o un token desconocido, no cambia nada ni falla.
  async execute(input: { refreshToken?: string }): Promise<void> {
    const { refreshTokens, tokens, clock } = this.deps;
    if (input.refreshToken === undefined) return;
    await refreshTokens.revokeFamilyByTokenHash(tokens.hash(input.refreshToken), clock.now());
  }
}
