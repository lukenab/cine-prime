-- =============================================================================
-- Migration V12: Remove SeatType.PREMIUM_COUPLE
-- Run on: movie_db
-- =============================================================================
-- Reverted the V11 rename — decided to drop the separate premium-couple tier
-- entirely rather than keep it under a generic name. Any existing rows fall
-- back to plain COUPLE (same colSpan=2 physical seat, just no price premium).

UPDATE seat SET seat_type = 'COUPLE' WHERE seat_type = 'PREMIUM_COUPLE';
UPDATE showtime_seat SET seat_type = 'COUPLE' WHERE seat_type = 'PREMIUM_COUPLE';

ALTER TABLE seat DROP CONSTRAINT chk_seat_type;
ALTER TABLE seat ADD CONSTRAINT chk_seat_type
    CHECK (seat_type IN ('STANDARD', 'VIP', 'COUPLE', 'ACCESSIBLE'));
