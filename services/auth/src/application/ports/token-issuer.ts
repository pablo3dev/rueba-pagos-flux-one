// port: out — emisión y verificación de access tokens y publicación del JWKS
import type { PublicJwk } from '../../domain/signing-key.js';

export interface TokenIssuer {
  issueAccessToken(user: {
    id: string;
    email: string;
  }): Promise<{ accessToken: string; expiresIn: number }>;
  // Lanza AccessTokenInvalidError ante cualquier fallo (ausente, expirado, firma, iss, aud, alg).
  verifyAccessToken(token: string): Promise<{ userId: string; email: string }>;
  getJwks(): { keys: PublicJwk[] };
}
