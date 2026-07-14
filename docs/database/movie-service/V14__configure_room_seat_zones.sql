-- =============================================================================
-- Migration V14: Configure Standard/VIP/Couple row allocation per cinema room
-- Run on: movie_db
-- =============================================================================
-- Before V14, SeatService derived the zone allocation from hard-coded RoomType
-- ratios. V14 persists the exact number of rows in each commercial seat zone.

ALTER TABLE cinema_room
    ADD COLUMN IF NOT EXISTS standard_row_count INTEGER,
    ADD COLUMN IF NOT EXISTS vip_row_count INTEGER,
    ADD COLUMN IF NOT EXISTS couple_row_count INTEGER;

-- Backfill existing rooms with the allocation used by the previous generator so
-- existing metadata remains consistent with already generated seat maps.
UPDATE cinema_room
SET couple_row_count = CASE
        WHEN number_of_rows >= 3 AND room_type <> 'IMAX' THEN 1
        ELSE 0
    END
WHERE couple_row_count IS NULL;

UPDATE cinema_room
SET vip_row_count = ROUND(
        (number_of_rows - couple_row_count) *
        CASE WHEN room_type = 'LARGE' THEN 0.35 ELSE 0.30 END
    )::INTEGER
WHERE vip_row_count IS NULL;

UPDATE cinema_room
SET standard_row_count = number_of_rows - vip_row_count - couple_row_count
WHERE standard_row_count IS NULL;

ALTER TABLE cinema_room
    ALTER COLUMN standard_row_count SET NOT NULL,
    ALTER COLUMN vip_row_count SET NOT NULL,
    ALTER COLUMN couple_row_count SET NOT NULL;

ALTER TABLE cinema_room
    DROP CONSTRAINT IF EXISTS chk_room_row_allocation_non_negative,
    DROP CONSTRAINT IF EXISTS chk_room_row_allocation_total,
    DROP CONSTRAINT IF EXISTS chk_room_has_single_seat_row,
    DROP CONSTRAINT IF EXISTS chk_couple_rows_even_width;

ALTER TABLE cinema_room
    ADD CONSTRAINT chk_room_row_allocation_non_negative
        CHECK (standard_row_count >= 0 AND vip_row_count >= 0 AND couple_row_count >= 0),
    ADD CONSTRAINT chk_room_row_allocation_total
        CHECK (standard_row_count + vip_row_count + couple_row_count = number_of_rows),
    ADD CONSTRAINT chk_room_has_single_seat_row
        CHECK (standard_row_count + vip_row_count > 0),
    ADD CONSTRAINT chk_couple_rows_even_width
        CHECK (couple_row_count = 0 OR MOD(seats_per_row, 2) = 0) NOT VALID;

-- NOT VALID intentionally preserves legacy rooms that were generated with an
-- odd seats_per_row and a Couple row under the old RoomType rules. PostgreSQL
-- still enforces this constraint for every new/updated room; the service also
-- rejects that input before persistence with error 2033.

COMMENT ON COLUMN cinema_room.standard_row_count IS
    'Number of front Standard rows configured for this room';
COMMENT ON COLUMN cinema_room.vip_row_count IS
    'Number of middle/rear VIP rows configured for this room';
COMMENT ON COLUMN cinema_room.couple_row_count IS
    'Number of rear Couple rows; seats_per_row must be even when greater than zero';
