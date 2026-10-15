// port: out — hash y verificación de contraseñas (adaptador: Argon2id)
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}
