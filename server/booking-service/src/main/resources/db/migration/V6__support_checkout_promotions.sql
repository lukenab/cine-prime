ALTER TABLE booking
    ADD COLUMN IF NOT EXISTS promotion_benefit_scope VARCHAR(20),
    ADD COLUMN IF NOT EXISTS ticket_promotion_discount NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS concession_promotion_discount NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE promotion_reservation
    ADD COLUMN IF NOT EXISTS benefit_scope VARCHAR(20) NOT NULL DEFAULT 'TICKETS',
    ADD COLUMN IF NOT EXISTS ticket_discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS concession_discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0;

ALTER TABLE booking
    ADD CONSTRAINT chk_booking_promotion_scope
        CHECK (promotion_benefit_scope IS NULL OR promotion_benefit_scope IN ('TICKETS', 'CONCESSIONS', 'ORDER'));

ALTER TABLE booking
    ADD CONSTRAINT chk_booking_promotion_allocations
        CHECK (ticket_promotion_discount >= 0 AND concession_promotion_discount >= 0);

ALTER TABLE promotion_reservation
    ADD CONSTRAINT chk_local_promotion_scope
        CHECK (benefit_scope IN ('TICKETS', 'CONCESSIONS', 'ORDER'));

UPDATE booking
SET promotion_benefit_scope = 'TICKETS',
    ticket_promotion_discount = COALESCE(promotion_discount_amount, 0)
WHERE promotion_reservation_id IS NOT NULL
  AND promotion_benefit_scope IS NULL;

UPDATE promotion_reservation
SET ticket_discount_amount = discount_amount
WHERE benefit_scope = 'TICKETS'
  AND ticket_discount_amount = 0;
