// port: out — generación de tokens opacos y su huella
// generate(): 32 bytes aleatorios codificados en base64url; tokenHash = SHA-256 hex (64 caracteres) del token.
// hash(token): SHA-256 hex (64 caracteres) del token recibido.
export interface OpaqueTokenGenerator {
  generate(): { token: string; tokenHash: string };
  hash(token: string): string;
}
