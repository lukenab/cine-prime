-- =============================================================================
-- Migration V11: Rename SeatType.SWEETBOX -> PREMIUM_COUPLE
-- Run on: movie_db
-- =============================================================================
-- "Sweetbox" is CGV's own trademarked product name, not a generic industry
-- term (unlike "Couple seat") — inappropriate to bake a specific competitor's
-- brand name into a generic multi-chain system. The underlying concept (a
-- pricier double-seat tier above regular Couple, 2.2x vs 1.8x — see V10) is
-- real across multiple chains and is kept, just under a generic name.

UPDATE seat SET seat_type = 'PREMIUM_COUPLE' WHERE seat_type = 'SWEETBOX';
UPDATE showtime_seat SET seat_type = 'PREMIUM_COUPLE' WHERE seat_type = 'SWEETBOX';

ALTER TABLE seat DROP CONSTRAINT chk_seat_type;
ALTER TABLE seat ADD CONSTRAINT chk_seat_type
    CHECK (seat_type IN ('STANDARD', 'VIP', 'COUPLE', 'PREMIUM_COUPLE', 'ACCESSIBLE'));
