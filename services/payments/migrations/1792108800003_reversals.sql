-- Up Migration
ALTER TABLE payment_schema.transfers DROP CONSTRAINT transfers_status_chk;
ALTER TABLE payment_schema.transfers ADD CONSTRAINT transfers_status_chk CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'UNKNOWN', 'REVERSED'));
ALTER TABLE payment_schema.transfers DROP CONSTRAINT transfers_internal_status_chk;
ALTER TABLE payment_schema.transfers ADD CONSTRAINT transfers_internal_status_chk CHECK (type = 'EXTERNAL' OR status IN ('COMPLETED', 'FAILED', 'REVERSED'));

CREATE TABLE payment_schema.reversals (
  id uuid PRIMARY KEY,
  transfer_id uuid NOT NULL REFERENCES payment_schema.transfers (id),
  requested_by_user_id uuid NOT NULL,
  amount numeric(18,2) NOT NULL,
  status varchar(16) NOT NULL,
  rejection_reason varchar(40),
  rail_reference varchar(64) UNIQUE,
  rail_attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  lease_until timestamptz,
  last_rail_outcome varchar(16),
  correlation_id varchar(64),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT reversals_amount_chk CHECK (amount > 0),
  CONSTRAINT reversals_status_chk CHECK (status IN ('PENDING', 'COMPLETED', 'REJECTED', 'UNKNOWN')),
  CONSTRAINT reversals_rejection_reason_chk CHECK (rejection_reason IS NULL OR rejection_reason IN ('RAIL_REJECTED', 'RAIL_UNAVAILABLE')),
  CONSTRAINT reversals_last_rail_outcome_chk CHECK (last_rail_outcome IS NULL OR last_rail_outcome IN ('ACCEPTED', 'REJECTED', 'UNAVAILABLE', 'TIMEOUT', 'NETWORK_ERROR', 'NOT_FOUND')),
  CONSTRAINT reversals_rejection_chk CHECK ((status = 'REJECTED') = (rejection_reason IS NOT NULL))
);
CREATE UNIQUE INDEX reversals_one_active_per_transfer ON payment_schema.reversals (transfer_id) WHERE status IN ('PENDING', 'UNKNOWN', 'COMPLETED');
CREATE INDEX reversals_rail_work_idx ON payment_schema.reversals (next_attempt_at) WHERE status IN ('PENDING', 'UNKNOWN');

-- Down Migration
DROP TABLE payment_schema.reversals;
ALTER TABLE payment_schema.transfers DROP CONSTRAINT transfers_internal_status_chk;
ALTER TABLE payment_schema.transfers DROP CONSTRAINT transfers_status_chk;
ALTER TABLE payment_schema.transfers ADD CONSTRAINT transfers_status_chk CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'UNKNOWN'));
ALTER TABLE payment_schema.transfers ADD CONSTRAINT transfers_internal_status_chk CHECK (type = 'EXTERNAL' OR status IN ('COMPLETED', 'FAILED'));
