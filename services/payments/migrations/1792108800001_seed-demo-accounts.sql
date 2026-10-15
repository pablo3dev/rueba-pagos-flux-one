-- Up Migration
INSERT INTO payment_schema.accounts (id, owner_user_id, currency, balance) VALUES
  ('ACC-001', '11111111-1111-4111-8111-111111111111', 'COP', 1000000.00),
  ('ACC-002', '22222222-2222-4222-8222-222222222222', 'COP', 500000.00),
  ('ACC-003', '33333333-3333-4333-8333-333333333333', 'COP', 0.00)
ON CONFLICT DO NOTHING;

-- Down Migration
DELETE FROM payment_schema.accounts WHERE id IN ('ACC-001', 'ACC-002', 'ACC-003');
