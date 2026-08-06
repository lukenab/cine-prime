ALTER TABLE payment_attempt
    ADD COLUMN provider_created_at TIMESTAMPTZ;

UPDATE payment_attempt
   SET provider_created_at = created_at
 WHERE provider_created_at IS NULL;

ALTER TABLE payment_attempt
    ALTER COLUMN provider_created_at SET NOT NULL;
