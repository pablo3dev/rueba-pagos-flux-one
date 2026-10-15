// adapter: out — PostgreSQL (pg) para SigningKeyRepository
import type { Pool } from 'pg';
import type { SigningKeyRepository } from '../../../application/ports/signing-key-repository.js';
import type { PublicJwk, SigningKey } from '../../../domain/signing-key.js';

interface SigningKeyRow {
  kid: string;
  alg: 'EdDSA';
  public_jwk: PublicJwk;
  private_key_pkcs8: string;
  active: boolean;
  created_at: Date;
}

const SIGNING_KEY_COLUMNS = 'kid, alg, public_jwk, private_key_pkcs8, active, created_at';

function toSigningKey(row: SigningKeyRow): SigningKey {
  return {
    kid: row.kid,
    alg: row.alg,
    publicJwk: row.public_jwk,
    privateKeyPkcs8: row.private_key_pkcs8,
    active: row.active,
    createdAt: row.created_at,
  };
}

export class PgSigningKeyRepository implements SigningKeyRepository {
  constructor(private readonly pool: Pool) {}

  async findActive(): Promise<SigningKey | null> {
    const { rows } = await this.pool.query<SigningKeyRow>(
      `SELECT ${SIGNING_KEY_COLUMNS} FROM auth_schema.signing_keys WHERE active`,
    );
    return rows[0] ? toSigningKey(rows[0]) : null;
  }

  // Idempotente: el índice único parcial signing_keys_one_active + ON CONFLICT DO NOTHING
  // dejan una sola llave activa aunque dos instancias inserten a la vez.
  async insertIfNoActive(key: SigningKey): Promise<void> {
    await this.pool.query(
      `INSERT INTO auth_schema.signing_keys (kid, alg, public_jwk, private_key_pkcs8, active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [key.kid, key.alg, key.publicJwk, key.privateKeyPkcs8, key.active, key.createdAt],
    );
  }

  async listAll(): Promise<SigningKey[]> {
    const { rows } = await this.pool.query<SigningKeyRow>(
      `SELECT ${SIGNING_KEY_COLUMNS} FROM auth_schema.signing_keys ORDER BY created_at ASC, kid ASC`,
    );
    return rows.map(toSigningKey);
  }
}
