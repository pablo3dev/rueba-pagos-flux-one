-- Up Migration
CREATE TABLE payment_schema.accounts (
  id varchar(20) PRIMARY KEY,
  owner_user_id uuid NOT NULL,
  currency char(3) NOT NULL DEFAULT 'COP',
  balance numeric(18,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT accounts_id_chk CHECK (id ~ '^ACC-[0-9]{3,}$'),
  CONSTRAINT accounts_currency_chk CHECK (currency = 'COP'),
  CONSTRAINT accounts_balance_chk CHECK (balance >= 0)
);
CREATE INDEX accounts_owner_user_id_idx ON payment_schema.accounts (owner_user_id);

CREATE TABLE payment_schema.transfers (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL,
  type varchar(10) NOT NULL,
  from_account_id varchar(20) NOT NULL REFERENCES payment_schema.accounts (id),
  to_account_id varchar(20) NOT NULL REFERENCES payment_schema.accounts (id),
  amount numeric(18,2) NOT NULL,
  currency char(3) NOT NULL DEFAULT 'COP',
  status varchar(16) NOT NULL,
  failure_reason varchar(40),
  correlation_id varchar(64),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT transfers_type_chk CHECK (type = 'INTERNAL'),
  CONSTRAINT transfers_amount_chk CHECK (amount > 0),
  CONSTRAINT transfers_currency_chk CHECK (currency = 'COP'),
  CONSTRAINT transfers_status_chk CHECK (status IN ('COMPLETED', 'FAILED')),
  CONSTRAINT transfers_failure_reason_chk CHECK (failure_reason IS NULL OR failure_reason = 'INSUFFICIENT_FUNDS'),
  CONSTRAINT transfers_distinct_chk CHECK (from_account_id <> to_account_id),
  CONSTRAINT transfers_failure_chk CHECK ((status = 'FAILED') = (failure_reason IS NOT NULL))
);
CREATE INDEX transfers_from_account_idx ON payment_schema.transfers (from_account_id, created_at DESC, id DESC);
CREATE INDEX transfers_to_account_idx ON payment_schema.transfers (to_account_id, created_at DESC, id DESC);

CREATE TABLE payment_schema.idempotency_keys (
  user_id uuid NOT NULL,
  operation varchar(80) NOT NULL,
  idempotency_key varchar(255) NOT NULL,
  request_hash char(64) NOT NULL,
  status varchar(16) NOT NULL,
  response_status smallint,
  response_body jsonb,
  resource_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (user_id, operation, idempotency_key),
  CONSTRAINT idempotency_keys_status_chk CHECK (status IN ('IN_PROGRESS', 'COMPLETED'))
);

-- Down Migration
DROP TABLE payment_schema.idempotency_keys;
DROP TABLE payment_schema.transfers;
DROP TABLE payment_schema.accounts;
