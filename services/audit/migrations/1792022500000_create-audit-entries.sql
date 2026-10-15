-- Up Migration
CREATE TABLE audit_schema.audit_entries (
  event_id uuid PRIMARY KEY,
  event_type varchar(60) NOT NULL,
  aggregate_type varchar(20) NOT NULL,
  aggregate_id uuid NOT NULL,
  actor_user_id uuid,
  visible_to_user_ids uuid[] NOT NULL,
  correlation_id varchar(64),
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL,
  CONSTRAINT audit_entries_event_type_chk CHECK (
    event_type IN (
      'transfer.created',
      'transfer.completed',
      'transfer.failed',
      'transfer.unknown',
      'transfer.reversal_requested',
      'transfer.reversed',
      'transfer.reversal_rejected'
    )
  ),
  CONSTRAINT audit_entries_aggregate_type_chk CHECK (aggregate_type = 'TRANSFER'),
  CONSTRAINT audit_entries_visible_users_chk CHECK (cardinality(visible_to_user_ids) >= 1)
);

CREATE INDEX audit_entries_aggregate_id_occurred_at_event_id_idx
  ON audit_schema.audit_entries (aggregate_id, occurred_at, event_id);

CREATE INDEX audit_entries_visible_gin
  ON audit_schema.audit_entries USING gin (visible_to_user_ids);

-- Append-only: el rol de la aplicación solo lee e inserta. pgmigrations queda aparte.
REVOKE ALL ON TABLE audit_schema.audit_entries FROM audit_svc;
GRANT SELECT, INSERT ON TABLE audit_schema.audit_entries TO audit_svc;

-- Down Migration
DROP TABLE audit_schema.audit_entries;
