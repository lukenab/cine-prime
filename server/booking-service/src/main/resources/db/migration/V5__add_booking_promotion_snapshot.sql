ALTER TABLE booking
    ADD COLUMN IF NOT EXISTS promotion_id VARCHAR(36),
    ADD COLUMN IF NOT EXISTS promotion_code VARCHAR(100),
    ADD COLUMN IF NOT EXISTS promotion_reservation_id VARCHAR(36),
    ADD COLUMN IF NOT EXISTS promotion_discount_amount NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS promotion_currency VARCHAR(10);

CREATE UNIQUE INDEX IF NOT EXISTS uq_booking_promotion_reservation
    ON booking (promotion_reservation_id)
    WHERE promotion_reservation_id IS NOT NULL;
