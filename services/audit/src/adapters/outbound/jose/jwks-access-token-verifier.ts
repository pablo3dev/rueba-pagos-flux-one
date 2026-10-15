// adapter: out — jose (verificación remota del JWT de auth vía JWKS)
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AccessTokenVerifier } from '../../../application/ports/access-token-verifier.js';
import { isUuid } from '../../../domain/audit-entry.js';
import { UnauthorizedError } from '../../../domain/errors.js';

export class JwksAccessTokenVerifier implements AccessTokenVerifier {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly options: { jwksUrl: string; issuer: string; audience: string }) {
    this.jwks = createRemoteJWKSet(new URL(options.jwksUrl));
  }

  async verify(token: string): Promise<{ userId: string }> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.options.issuer,
        audience: this.options.audience,
        algorithms: ['EdDSA'],
        clockTolerance: '5s',
      });
      if (typeof payload.sub !== 'string' || !isUuid(payload.sub)) throw new UnauthorizedError();
      return { userId: payload.sub };
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      throw new UnauthorizedError();
    }
  }
}
