-- Up Migration
CREATE TABLE payment_schema.outbox_events (
  id uuid PRIMARY KEY,
  event_type varchar(60) NOT NULL,
  aggregate_type varchar(20) NOT NULL DEFAULT 'TRANSFER',
  aggregate_id uuid NOT NULL,
  payload jsonb NOT NULL,
  correlation_id varchar(64),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outbox_events_type_chk CHECK (event_type IN (
    'transfer.created',
    'transfer.completed',
    'transfer.failed',
    'transfer.unknown',
    'transfer.reversal_requested',
    'transfer.reversed',
    'transfer.reversal_rejected'
  )),
  CONSTRAINT outbox_events_aggregate_chk CHECK (aggregate_type = 'TRANSFER')
);
CREATE INDEX outbox_pending_idx ON payment_schema.outbox_events (next_attempt_at, created_at) WHERE published_at IS NULL;

-- Down Migration
DROP TABLE payment_schema.outbox_events;
