ALTER TABLE booking
    ADD COLUMN concession_order_id VARCHAR(50),
    ADD COLUMN concession_pickup_code VARCHAR(20);

ALTER TABLE booking_concession_item
    ADD COLUMN options_snapshot TEXT NOT NULL DEFAULT '';

ALTER TABLE booking_concession_item
    DROP CONSTRAINT IF EXISTS booking_concession_item_idempotency_key_key;

CREATE UNIQUE INDEX uq_booking_concession_snapshot_key
    ON booking_concession_item(idempotency_key);

CREATE INDEX idx_booking_concession_reservation
    ON booking_concession_item(external_reservation_id);
