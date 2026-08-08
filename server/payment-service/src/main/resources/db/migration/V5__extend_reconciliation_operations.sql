ALTER TABLE payment_reconciliation_case
    ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(120),
    ADD COLUMN IF NOT EXISTS resolution_note VARCHAR(1000),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE payment_reconciliation_case
   SET updated_at = COALESCE(resolved_at, created_at)
 WHERE updated_at IS NULL;

ALTER TABLE payment_reconciliation_case
    ALTER COLUMN updated_at SET NOT NULL;

