import { describe, expect, it } from 'vitest';
import { LoginUser } from '../../../src/application/use-cases/login-user.js';
import { InvalidCredentialsError } from '../../../src/domain/errors.js';
import {
  FakeClock,
  FakeOpaqueTokenGenerator,
  FakePasswordHasher,
  FakeTokenIssuer,
  InMemoryRefreshTokenRepository,
  InMemoryUserRepository,
} from '../../support/fakes.js';

const PASSWORD = 'clave-demo-123456';
const DUMMY_HASH = 'hashed:dummy-password-hash';
const USER_ID = '11111111-1111-4111-8111-111111111111';

async function setup() {
  const users = new InMemoryUserRepository();
  const refreshTokens = new InMemoryRefreshTokenRepository();
  const hasher = new FakePasswordHasher();
  const tokens = new FakeOpaqueTokenGenerator();
  const clock = new FakeClock();
  const now = clock.now();
  await users.insert({
    id: USER_ID,
    email: 'alice@fluxone.test',
    passwordHash: await hasher.hash(PASSWORD),
    createdAt: now,
    updatedAt: now,
  });
  const loginUser = new LoginUser({
    users,
    refreshTokens,
    hasher,
    tokenIssuer: new FakeTokenIssuer(),
    tokens,
    clock,
    dummyPasswordHash: DUMMY_HASH,
  });
  return { refreshTokens, hasher, tokens, clock, loginUser };
}

describe('LoginUser', () => {
  it('[AC-AUT-06] credenciales válidas devuelven la sesión con access token y refresh token', async () => {
    const { loginUser } = await setup();

    const result = await loginUser.execute({ email: 'alice@fluxone.test', password: PASSWORD });

    expect(result).toEqual({
      accessToken: `access:${USER_ID}`,
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { id: USER_ID, email: 'alice@fluxone.test' },
      refreshToken: 'opaque-1',
      refreshTokenMaxAgeSeconds: 604800,
    });
  });

  it('[AC-AUT-14] persiste solo la huella del refresh token, con vigencia de 7 días y familia nueva', async () => {
    const { refreshTokens, tokens, clock, loginUser } = await setup();

    const result = await loginUser.execute({ email: 'alice@fluxone.test', password: PASSWORD });

    expect(refreshTokens.tokens).toHaveLength(1);
    const stored = refreshTokens.tokens[0];
    expect(stored).toMatchObject({
      userId: USER_ID,
      tokenHash: tokens.hash(result.refreshToken),
      expiresAt: new Date(clock.now().getTime() + 604800 * 1000),
      revokedAt: null,
      replacedById: null,
      createdAt: clock.now(),
    });
    expect(stored?.tokenHash).toHaveLength(64);
    expect(stored?.tokenHash).not.toBe(result.refreshToken);
    expect(stored?.familyId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('[AC-AUT-06] normaliza el email (trim y minúsculas) antes de buscar al usuario', async () => {
    const { loginUser } = await setup();

    const result = await loginUser.execute({ email: '  ALICE@FluxOne.Test ', password: PASSWORD });

    expect(result.user.id).toBe(USER_ID);
  });

  it('[AC-AUT-07] email inexistente verifica contra dummyPasswordHash y lanza InvalidCredentialsError', async () => {
    const { refreshTokens, hasher, loginUser } = await setup();

    await expect(
      loginUser.execute({ email: 'nadie@fluxone.test', password: PASSWORD }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect(hasher.verifyCalls).toEqual([{ hash: DUMMY_HASH, plain: PASSWORD }]);
    expect(refreshTokens.tokens).toHaveLength(0);
  });

  it('[AC-AUT-07] contraseña incorrecta lanza InvalidCredentialsError sin crear sesión', async () => {
    const { refreshTokens, hasher, loginUser } = await setup();

    await expect(
      loginUser.execute({ email: 'alice@fluxone.test', password: 'otra-clave-incorrecta' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect(hasher.verifyCalls).toHaveLength(1);
    expect(hasher.verifyCalls[0]?.hash).not.toBe(DUMMY_HASH);
    expect(refreshTokens.tokens).toHaveLength(0);
  });

  it('[AC-AUT-07] un email malformado no se valida: responde InvalidCredentialsError', async () => {
    const { loginUser } = await setup();

    await expect(loginUser.execute({ email: 'no-es-email', password: 'x' })).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });
});
