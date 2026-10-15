// port: out — verificación del access token emitido por auth (JWKS)
export interface AccessTokenVerifier {
  verify(token: string): Promise<{ userId: string }>;
}
