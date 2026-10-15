// port: out — verificación de credencial que el caso de uso necesita
export interface TokenVerifier {
  verify(token: string): Promise<{ userId: string }>;
}
