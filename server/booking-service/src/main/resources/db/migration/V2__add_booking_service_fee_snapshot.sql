ALTER TABLE booking
    ADD COLUMN IF NOT EXISTS service_fee_amount NUMERIC(15,2) NOT NULL DEFAULT 0;

ALTER TABLE booking
    ADD CONSTRAINT ck_booking_service_fee_non_negative
    CHECK (service_fee_amount >= 0);
