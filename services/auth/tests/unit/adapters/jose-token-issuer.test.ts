import { decodeJwt, decodeProtectedHeader, importPKCS8, SignJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { JoseSigningKeyGenerator } from '../../../src/adapters/outbound/crypto/jose-signing-key-generator.js';
import { JoseTokenIssuer } from '../../../src/adapters/outbound/crypto/jose-token-issuer.js';
import { AccessTokenInvalidError } from '../../../src/domain/errors.js';
import type { SigningKey } from '../../../src/domain/signing-key.js';
import { FakeClock } from '../../support/fakes.js';

const ISSUER = 'urn:fluxone:auth';
const AUDIENCE = 'urn:fluxone:api';
const START = new Date('2026-03-01T10:00:00.000Z');
const USER = { id: '11111111-1111-4111-8111-111111111111', email: 'alice@fluxone.test' };

describe('JoseTokenIssuer', () => {
  let key: SigningKey;
  let clock: FakeClock;
  let issuer: JoseTokenIssuer;

  beforeAll(async () => {
    key = await new JoseSigningKeyGenerator(new FakeClock(START)).generate();
  });

  const build = (overrides: { issuer?: string; audience?: string; keys?: SigningKey[] } = {}) =>
    new JoseTokenIssuer({
      keys: overrides.keys ?? [key],
      issuer: overrides.issuer ?? ISSUER,
      audience: overrides.audience ?? AUDIENCE,
      clock,
    });

  const issue = async () => (await issuer.issueAccessToken(USER)).accessToken;

  const expectInvalid = (token: string, verifier: JoseTokenIssuer = issuer) =>
    expect(verifier.verifyAccessToken(token)).rejects.toBeInstanceOf(AccessTokenInvalidError);

  it('[AC-AUT-09] emite un JWT con header alg EdDSA y kid, y expiresIn 900', async () => {
    clock = new FakeClock(START);
    issuer = build();

    const { accessToken, expiresIn } = await issuer.issueAccessToken(USER);

    expect(expiresIn).toBe(900);
    expect(decodeProtectedHeader(accessToken)).toEqual({ alg: 'EdDSA', kid: key.kid });
  });

  it('[AC-AUT-09] el JWT lleva iss, aud, sub, email y exp - iat = 900', async () => {
    clock = new FakeClock(START);
    issuer = build();

    const claims = decodeJwt(await issue());

    expect(claims.iss).toBe(ISSUER);
    expect(claims.aud).toBe(AUDIENCE);
    expect(claims.sub).toBe(USER.id);
    expect(claims.email).toBe(USER.email);
    expect(claims.iat).toBe(Math.floor(START.getTime() / 1000));
    expect((claims.exp as number) - (claims.iat as number)).toBe(900);
  });

  it('[AC-AUT-09] verifica un token emitido y devuelve userId y email', async () => {
    clock = new FakeClock(START);
    issuer = build();

    await expect(issuer.verifyAccessToken(await issue())).resolves.toEqual({
      userId: USER.id,
      email: USER.email,
    });
  });

  it('[AC-AUT-09] firma con la llave activa aunque haya otras llaves', async () => {
    clock = new FakeClock(START);
    const other = await new JoseSigningKeyGenerator(clock).generate();
    issuer = build({ keys: [{ ...other, active: false }, key] });

    const token = await issue();

    expect(decodeProtectedHeader(token).kid).toBe(key.kid);
    await expect(issuer.verifyAccessToken(token)).resolves.toMatchObject({ userId: USER.id });
  });

  it('[AC-AUT-18] rechaza un token expirado', async () => {
    clock = new FakeClock(START);
    issuer = build();
    const token = await issue();

    clock.set(new Date(START.getTime() + (900 + 6) * 1000));

    await expectInvalid(token);
  });

  it('[AC-AUT-18] acepta un token dentro de la tolerancia de 5 s tras expirar', async () => {
    clock = new FakeClock(START);
    issuer = build();
    const token = await issue();

    clock.set(new Date(START.getTime() + (900 + 4) * 1000));

    await expect(issuer.verifyAccessToken(token)).resolves.toMatchObject({ userId: USER.id });
  });

  it('[AC-AUT-18] rechaza un token con iss incorrecto', async () => {
    clock = new FakeClock(START);
    issuer = build();
    const token = await issue();

    await expectInvalid(token, build({ issuer: 'urn:otro:emisor' }));
  });

  it('[AC-AUT-18] rechaza un token con aud incorrecto', async () => {
    clock = new FakeClock(START);
    issuer = build();
    const token = await issue();

    await expectInvalid(token, build({ audience: 'urn:otra:audiencia' }));
  });

  it('[AC-AUT-18] rechaza un token con alg distinto de EdDSA', async () => {
    clock = new FakeClock(START);
    issuer = build();
    const now = Math.floor(START.getTime() / 1000);
    const hs256Token = await new SignJWT({ email: USER.email })
      .setProtectedHeader({ alg: 'HS256', kid: key.kid })
      .setSubject(USER.id)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt(now)
      .setExpirationTime(now + 900)
      .sign(new TextEncoder().encode('0123456789abcdef0123456789abcdef'));

    await expectInvalid(hs256Token);
  });

  it('[AC-AUT-18] rechaza un token firmado con una llave desconocida', async () => {
    clock = new FakeClock(START);
    issuer = build();
    const stranger = await new JoseSigningKeyGenerator(clock).generate();
    const strangerToken = await build({ keys: [stranger] }).issueAccessToken(USER);

    await expectInvalid(strangerToken.accessToken);
  });

  it('[AC-AUT-18] rechaza un token sin claim email', async () => {
    clock = new FakeClock(START);
    issuer = build();
    const now = Math.floor(START.getTime() / 1000);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'EdDSA', kid: key.kid })
      .setSubject(USER.id)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt(now)
      .setExpirationTime(now + 900)
      .sign(await importPKCS8(key.privateKeyPkcs8, 'EdDSA'));

    await expectInvalid(token);
  });

  it('[AC-AUT-18] rechaza una cadena que no es un JWT y una cadena vacía', async () => {
    clock = new FakeClock(START);
    issuer = build();

    await expectInvalid('no-es-un-jwt');
    await expectInvalid('');
  });

  it('[AC-AUT-19] getJwks devuelve la JWK pública de cada llave, sin parte privada', () => {
    clock = new FakeClock(START);
    issuer = build();

    const { keys } = issuer.getJwks();

    expect(keys).toEqual([key.publicJwk]);
    expect(JSON.stringify(keys)).not.toContain('"d"');
  });
});
