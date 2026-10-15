-- Up Migration
CREATE TABLE auth_schema.users (
  id uuid PRIMARY KEY,
  email varchar(254) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_lower_chk CHECK (email = lower(email))
);
CREATE TABLE auth_schema.refresh_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth_schema.users (id) ON DELETE CASCADE,
  family_id uuid NOT NULL,
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  replaced_by_id uuid REFERENCES auth_schema.refresh_tokens (id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_id_idx ON auth_schema.refresh_tokens (user_id);
CREATE INDEX refresh_tokens_family_id_idx ON auth_schema.refresh_tokens (family_id);
CREATE TABLE auth_schema.signing_keys (
  kid uuid PRIMARY KEY,
  alg varchar(10) NOT NULL DEFAULT 'EdDSA',
  public_jwk jsonb NOT NULL,
  private_key_pkcs8 text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT signing_keys_alg_chk CHECK (alg = 'EdDSA')
);
CREATE UNIQUE INDEX signing_keys_one_active ON auth_schema.signing_keys (active) WHERE active;

-- Down Migration
DROP TABLE auth_schema.signing_keys;
DROP TABLE auth_schema.refresh_tokens;
DROP TABLE auth_schema.users;
