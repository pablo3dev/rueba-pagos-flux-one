import { randomUUID } from 'node:crypto';
import { RefreshTokenInvalidError, RefreshTokenReusedError } from '../../domain/errors.js';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from '../../domain/refresh-token.js';
import type { Clock } from '../ports/clock.js';
import type { OpaqueTokenGenerator } from '../ports/opaque-token-generator.js';
import type { RefreshTokenRepository } from '../ports/refresh-token-repository.js';
import type { TokenIssuer } from '../ports/token-issuer.js';
import type { UserRepository } from '../ports/user-repository.js';
import type { SessionResult } from './login-user.js';

interface RefreshSessionDeps {
  users: UserRepository;
  refreshTokens: RefreshTokenRepository;
  tokenIssuer: TokenIssuer;
  tokens: OpaqueTokenGenerator;
  clock: Clock;
}

export class RefreshSession {
  constructor(private readonly deps: RefreshSessionDeps) {}

  // Idempotencia: un solo uso del refresh token; la rotación atómica del repositorio hace que
  // una repetición con el mismo token resulte en REUSED y revoque la familia.
  async execute(input: { refreshToken: string }): Promise<SessionResult> {
    const { users, refreshTokens, tokenIssuer, tokens, clock } = this.deps;
    const now = clock.now();
    const next = tokens.generate();
    const outcome = await refreshTokens.rotate({
      currentTokenHash: tokens.hash(input.refreshToken),
      now,
      next: {
        id: randomUUID(),
        tokenHash: next.tokenHash,
        expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000),
      },
    });

    switch (outcome.status) {
      case 'REUSED':
        throw new RefreshTokenReusedError(outcome.userId, outcome.familyId);
      case 'EXPIRED':
      case 'NOT_FOUND':
        throw new RefreshTokenInvalidError();
      case 'ROTATED': {
        const user = await users.findById(outcome.userId);
        if (user === null) throw new RefreshTokenInvalidError();
        const { accessToken } = await tokenIssuer.issueAccessToken({
          id: user.id,
          email: user.email,
        });
        return {
          accessToken,
          tokenType: 'Bearer',
          expiresIn: ACCESS_TOKEN_TTL_SECONDS,
          user: { id: user.id, email: user.email },
          refreshToken: next.token,
          refreshTokenMaxAgeSeconds: REFRESH_TOKEN_TTL_SECONDS,
        };
      }
    }
  }
}
