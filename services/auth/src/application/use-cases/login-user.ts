import { randomUUID } from 'node:crypto';
import { InvalidCredentialsError } from '../../domain/errors.js';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from '../../domain/refresh-token.js';
import type { Clock } from '../ports/clock.js';
import type { OpaqueTokenGenerator } from '../ports/opaque-token-generator.js';
import type { PasswordHasher } from '../ports/password-hasher.js';
import type { RefreshTokenRepository } from '../ports/refresh-token-repository.js';
import type { TokenIssuer } from '../ports/token-issuer.js';
import type { UserRepository } from '../ports/user-repository.js';

export interface SessionResult {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: 900;
  user: { id: string; email: string };
  refreshToken: string; // va a la cookie, nunca al cuerpo de la respuesta
  refreshTokenMaxAgeSeconds: 604800;
}

interface LoginUserDeps {
  users: UserRepository;
  refreshTokens: RefreshTokenRepository;
  hasher: PasswordHasher;
  tokenIssuer: TokenIssuer;
  tokens: OpaqueTokenGenerator;
  clock: Clock;
  dummyPasswordHash: string;
}

export class LoginUser {
  constructor(private readonly deps: LoginUserDeps) {}

  // Idempotencia: no aplica; cada login crea una sesión nueva (efecto aditivo por diseño).
  async execute(input: { email: string; password: string }): Promise<SessionResult> {
    const { users, refreshTokens, hasher, tokenIssuer, tokens, clock, dummyPasswordHash } =
      this.deps;
    const now = clock.now();
    // No valida la forma del email: un email malformado simplemente no existe.
    const user = await users.findByEmail(input.email.trim().toLowerCase());
    if (user === null) {
      // Iguala el tiempo de respuesta con el de un usuario existente.
      await hasher.verify(dummyPasswordHash, input.password);
      throw new InvalidCredentialsError();
    }
    if (!(await hasher.verify(user.passwordHash, input.password))) {
      throw new InvalidCredentialsError();
    }

    const { accessToken } = await tokenIssuer.issueAccessToken({ id: user.id, email: user.email });
    const refresh = tokens.generate();
    await refreshTokens.insert({
      id: randomUUID(),
      userId: user.id,
      familyId: randomUUID(),
      tokenHash: refresh.tokenHash,
      expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000),
      revokedAt: null,
      replacedById: null,
      createdAt: now,
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: { id: user.id, email: user.email },
      refreshToken: refresh.token,
      refreshTokenMaxAgeSeconds: REFRESH_TOKEN_TTL_SECONDS,
    };
  }
}
