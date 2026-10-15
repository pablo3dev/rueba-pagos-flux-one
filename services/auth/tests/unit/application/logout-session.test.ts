import { describe, expect, it } from 'vitest';
import { LogoutSession } from '../../../src/application/use-cases/logout-session.js';
import {
  FakeClock,
  FakeOpaqueTokenGenerator,
  InMemoryRefreshTokenRepository,
} from '../../support/fakes.js';

const FAMILY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_FAMILY_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function setup() {
  const refreshTokens = new InMemoryRefreshTokenRepository();
  const tokens = new FakeOpaqueTokenGenerator();
  const clock = new FakeClock();
  const logoutSession = new LogoutSession({ refreshTokens, tokens, clock });

  async function seedToken(plain: string, familyId: string) {
    await refreshTokens.insert({
      id: `id-${plain}`,
      userId: '11111111-1111-4111-8111-111111111111',
      familyId,
      tokenHash: tokens.hash(plain),
      expiresAt: new Date(clock.now().getTime() + 604800 * 1000),
      revokedAt: null,
      replacedById: null,
      createdAt: clock.now(),
    });
  }

  return { refreshTokens, tokens, clock, logoutSession, seedToken };
}

describe('LogoutSession', () => {
  it('[AC-AUT-15] con un token válido revoca toda su familia y no toca otras', async () => {
    const { refreshTokens, clock, logoutSession, seedToken } = setup();
    await seedToken('old', FAMILY_ID);
    await seedToken('current', FAMILY_ID);
    await seedToken('other', OTHER_FAMILY_ID);

    await logoutSession.execute({ refreshToken: 'current' });

    const revoked = (id: string) => refreshTokens.tokens.find((t) => t.id === id)?.revokedAt;
    expect(revoked('id-old')).toEqual(clock.now());
    expect(revoked('id-current')).toEqual(clock.now());
    expect(revoked('id-other')).toBeNull();
  });

  it('[AC-AUT-16] con un token desconocido no falla ni revoca nada', async () => {
    const { refreshTokens, logoutSession, seedToken } = setup();
    await seedToken('current', FAMILY_ID);

    await expect(logoutSession.execute({ refreshToken: 'desconocido' })).resolves.toBeUndefined();

    expect(refreshTokens.revokeFamilyCalls).toHaveLength(1);
    expect(refreshTokens.tokens[0]?.revokedAt).toBeNull();
  });

  it('[AC-AUT-16] sin token no hace nada', async () => {
    const { refreshTokens, logoutSession } = setup();

    await expect(logoutSession.execute({})).resolves.toBeUndefined();

    expect(refreshTokens.revokeFamilyCalls).toHaveLength(0);
  });

  it('[AC-AUT-15] repetir el cierre con un token ya revocado no falla ni cambia la fecha de revocación', async () => {
    const { refreshTokens, clock, logoutSession, seedToken } = setup();
    await seedToken('current', FAMILY_ID);
    await logoutSession.execute({ refreshToken: 'current' });
    const firstRevokedAt = refreshTokens.tokens[0]?.revokedAt;
    clock.set(new Date('2026-01-01T13:00:00.000Z'));

    await expect(logoutSession.execute({ refreshToken: 'current' })).resolves.toBeUndefined();

    expect(refreshTokens.tokens[0]?.revokedAt).toEqual(firstRevokedAt);
  });
});
