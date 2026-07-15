-- =============================================================================
-- Migration V13: Persist numberOfRows/seatsPerRow on cinema_room
-- Run on: movie_db
-- =============================================================================
-- New room-creation flow: admin picks RoomType (just a default+limit provider now),
-- adjusts numberOfRows/seatsPerRow, frontend shows an estimate, backend validates
-- against RoomType.maxSeats and computes totalSeatCapacity itself. Seat generation
-- (SeatService) now reads numberOfRows/seatsPerRow directly from the room instead of
-- deriving row count from totalSeatCapacity / RoomType's old fixed seatsPerRow.
--
-- Backfill for existing rooms: every room so far was generated with the OLD fixed
-- per-RoomType seatsPerRow (STANDARD/LARGE=10, IMAX=15), so seats_per_row is
-- reconstructed from room_type, and number_of_rows from ceil(total_seat_capacity /
-- seats_per_row) — the same formula SeatService used to compute at generation time.

ALTER TABLE cinema_room
    ADD COLUMN IF NOT EXISTS number_of_rows INTEGER,
    ADD COLUMN IF NOT EXISTS seats_per_row INTEGER;

UPDATE cinema_room
SET seats_per_row = CASE room_type WHEN 'IMAX' THEN 15 ELSE 10 END
WHERE seats_per_row IS NULL;

UPDATE cinema_room
SET number_of_rows = CEIL(total_seat_capacity::numeric / seats_per_row)
WHERE number_of_rows IS NULL;

ALTER TABLE cinema_room
    ALTER COLUMN number_of_rows SET NOT NULL,
    ALTER COLUMN seats_per_row SET NOT NULL;
