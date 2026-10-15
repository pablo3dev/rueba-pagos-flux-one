// adapter: out — jose (access token JWT EdDSA y JWKS)
import { createLocalJWKSet, importPKCS8, jwtVerify, SignJWT } from 'jose';
import type { Clock } from '../../../application/ports/clock.js';
import type { TokenIssuer } from '../../../application/ports/token-issuer.js';
import { ACCESS_TOKEN_TTL_SECONDS } from '../../../domain/refresh-token.js';
import { AccessTokenInvalidError } from '../../../domain/errors.js';
import type { PublicJwk, SigningKey } from '../../../domain/signing-key.js';

export interface JoseTokenIssuerOptions {
  keys: SigningKey[];
  issuer: string;
  audience: string;
  clock: Clock;
}

export class JoseTokenIssuer implements TokenIssuer {
  constructor(private readonly options: JoseTokenIssuerOptions) {}

  async issueAccessToken(user: {
    id: string;
    email: string;
  }): Promise<{ accessToken: string; expiresIn: number }> {
    const { keys, issuer, audience, clock } = this.options;
    const activeKey = keys.find((k) => k.active);
    if (activeKey === undefined) throw new Error('no active signing key');

    const privateKey = await importPKCS8(activeKey.privateKeyPkcs8, 'EdDSA');
    const now = Math.floor(clock.now().getTime() / 1000);
    const accessToken = await new SignJWT({ email: user.email })
      .setProtectedHeader({ alg: 'EdDSA', kid: activeKey.kid })
      .setSubject(user.id)
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt(now)
      .setExpirationTime(now + ACCESS_TOKEN_TTL_SECONDS)
      .sign(privateKey);
    return { accessToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
  }

  async verifyAccessToken(token: string): Promise<{ userId: string; email: string }> {
    const { issuer, audience, clock } = this.options;
    try {
      const jwks = createLocalJWKSet({ keys: this.getJwks().keys });
      const { payload } = await jwtVerify(token, jwks, {
        issuer,
        audience,
        algorithms: ['EdDSA'],
        clockTolerance: '5s',
        currentDate: clock.now(),
      });
      const { sub, email } = payload;
      if (typeof sub !== 'string' || typeof email !== 'string') {
        throw new AccessTokenInvalidError();
      }
      return { userId: sub, email };
    } catch {
      throw new AccessTokenInvalidError();
    }
  }

  getJwks(): { keys: PublicJwk[] } {
    return { keys: this.options.keys.map((k) => k.publicJwk) };
  }
}
