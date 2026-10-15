// adapter: out — jose (JWT EdDSA contra JWKS remoto)
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Clock } from '../../../application/ports/clock.js';
import type { TokenVerifier } from '../../../application/ports/token-verifier.js';
import { AccessTokenInvalidError } from '../../../domain/errors.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class JoseTokenVerifier implements TokenVerifier {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    private readonly options: { jwksUrl: string; issuer: string; audience: string; clock: Clock },
  ) {
    this.jwks = createRemoteJWKSet(new URL(options.jwksUrl));
  }

  async verify(token: string): Promise<{ userId: string }> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.options.issuer,
        audience: this.options.audience,
        algorithms: ['EdDSA'],
        clockTolerance: '5s',
        currentDate: this.options.clock.now(),
      });
      if (typeof payload.sub !== 'string' || !UUID.test(payload.sub)) throw new AccessTokenInvalidError();
      return { userId: payload.sub };
    } catch (error) {
      if (error instanceof AccessTokenInvalidError) throw error;
      throw new AccessTokenInvalidError();
    }
  }
}
