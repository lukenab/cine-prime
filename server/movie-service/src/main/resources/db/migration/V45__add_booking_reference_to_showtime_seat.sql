-- Keep the movie-service seat inventory compatible with databases that were
-- initialized before booking ownership was added to ShowtimeSeat.
--
-- booking_id intentionally has no foreign key: the booking aggregate belongs
-- to booking-service and is stored in a separate database.
ALTER TABLE showtime_seat
    ADD COLUMN IF NOT EXISTS booking_id VARCHAR(36);

CREATE INDEX IF NOT EXISTS idx_ss_booking
    ON showtime_seat (booking_id)
    WHERE booking_id IS NOT NULL;

COMMENT ON COLUMN showtime_seat.booking_id IS
    'Booking UUID owned by booking-service; no cross-database foreign key.';
