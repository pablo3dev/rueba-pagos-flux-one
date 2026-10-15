import { describe, expect, it } from 'vitest';
import { RefreshSession } from '../../../src/application/use-cases/refresh-session.js';
import { RefreshTokenInvalidError, RefreshTokenReusedError } from '../../../src/domain/errors.js';
import {
  FakeClock,
  FakeOpaqueTokenGenerator,
  FakeTokenIssuer,
  InMemoryRefreshTokenRepository,
  InMemoryUserRepository,
} from '../../support/fakes.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const FAMILY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SEVEN_DAYS_MS = 604800 * 1000;

async function setup() {
  const users = new InMemoryUserRepository();
  const refreshTokens = new InMemoryRefreshTokenRepository();
  const tokens = new FakeOpaqueTokenGenerator();
  const clock = new FakeClock();
  const now = clock.now();
  await users.insert({
    id: USER_ID,
    email: 'alice@fluxone.test',
    passwordHash: 'hashed:x',
    createdAt: now,
    updatedAt: now,
  });
  const refreshSession = new RefreshSession({
    users,
    refreshTokens,
    tokenIssuer: new FakeTokenIssuer(),
    tokens,
    clock,
  });

  // Siembra una sesión existente cuyo refresh token en claro es `plain`.
  async function seedToken(plain: string, overrides: { expiresAt?: Date; revokedAt?: Date } = {}) {
    await refreshTokens.insert({
      id: `id-${plain}`,
      userId: USER_ID,
      familyId: FAMILY_ID,
      tokenHash: tokens.hash(plain),
      expiresAt: overrides.expiresAt ?? new Date(now.getTime() + SEVEN_DAYS_MS),
      revokedAt: overrides.revokedAt ?? null,
      replacedById: null,
      createdAt: now,
    });
  }

  return { users, refreshTokens, tokens, clock, refreshSession, seedToken };
}

describe('RefreshSession', () => {
  it('[AC-AUT-11] un refresh token vigente rota: devuelve sesión nueva e inutiliza el anterior', async () => {
    const { refreshTokens, tokens, clock, refreshSession, seedToken } = await setup();
    await seedToken('current');

    const result = await refreshSession.execute({ refreshToken: 'current' });

    expect(result).toEqual({
      accessToken: `access:${USER_ID}`,
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { id: USER_ID, email: 'alice@fluxone.test' },
      refreshToken: 'opaque-1',
      refreshTokenMaxAgeSeconds: 604800,
    });
    const old = refreshTokens.tokens.find((t) => t.tokenHash === tokens.hash('current'));
    const successor = refreshTokens.tokens.find((t) => t.tokenHash === tokens.hash('opaque-1'));
    expect(successor).toMatchObject({ userId: USER_ID, familyId: FAMILY_ID, revokedAt: null });
    expect(old).toMatchObject({ revokedAt: clock.now(), replacedById: successor?.id });
  });

  it('[AC-AUT-14] el token sucesor guarda solo su huella y vence a los 7 días', async () => {
    const { refreshTokens, tokens, clock, refreshSession, seedToken } = await setup();
    await seedToken('current');

    const result = await refreshSession.execute({ refreshToken: 'current' });

    const successor = refreshTokens.tokens.find(
      (t) => t.tokenHash === tokens.hash(result.refreshToken),
    );
    expect(successor?.tokenHash).toHaveLength(64);
    expect(successor?.expiresAt).toEqual(new Date(clock.now().getTime() + SEVEN_DAYS_MS));
  });

  it('[AC-AUT-12] reutilizar un token ya rotado lanza RefreshTokenReusedError y revoca la familia', async () => {
    const { refreshTokens, refreshSession, seedToken } = await setup();
    await seedToken('current');
    const first = await refreshSession.execute({ refreshToken: 'current' });

    const reuse = refreshSession.execute({ refreshToken: 'current' });

    await expect(reuse).rejects.toBeInstanceOf(RefreshTokenReusedError);
    await expect(reuse).rejects.toMatchObject({ userId: USER_ID, familyId: FAMILY_ID });
    expect(refreshTokens.tokens.every((t) => t.revokedAt !== null)).toBe(true);
    // El sucesor, aunque nunca se usó, quedó revocado: reutilizarlo también es REUSED.
    await expect(
      refreshSession.execute({ refreshToken: first.refreshToken }),
    ).rejects.toBeInstanceOf(RefreshTokenReusedError);
  });

  it('[AC-AUT-12] un token revocado (aunque no rotado) lanza RefreshTokenReusedError', async () => {
    const { clock, refreshSession, seedToken } = await setup();
    await seedToken('revoked', { revokedAt: clock.now() });

    await expect(refreshSession.execute({ refreshToken: 'revoked' })).rejects.toBeInstanceOf(
      RefreshTokenReusedError,
    );
  });

  it('[AC-AUT-13] un token desconocido lanza RefreshTokenInvalidError', async () => {
    const { refreshTokens, refreshSession } = await setup();

    await expect(refreshSession.execute({ refreshToken: 'desconocido' })).rejects.toBeInstanceOf(
      RefreshTokenInvalidError,
    );
    expect(refreshTokens.tokens).toHaveLength(0);
  });

  it('[AC-AUT-13] un token expirado lanza RefreshTokenInvalidError sin rotar', async () => {
    const { refreshTokens, clock, refreshSession, seedToken } = await setup();
    await seedToken('expired', { expiresAt: clock.now() });

    await expect(refreshSession.execute({ refreshToken: 'expired' })).rejects.toBeInstanceOf(
      RefreshTokenInvalidError,
    );
    expect(refreshTokens.tokens).toHaveLength(1);
    expect(refreshTokens.tokens[0]?.revokedAt).toBeNull();
  });

  it('[AC-AUT-13] si el usuario del token ya no existe lanza RefreshTokenInvalidError', async () => {
    const { users, refreshSession, seedToken } = await setup();
    await seedToken('current');
    users.users.length = 0;

    await expect(refreshSession.execute({ refreshToken: 'current' })).rejects.toBeInstanceOf(
      RefreshTokenInvalidError,
    );
  });
});
