-- The V1 baseline's `no_overlapping_showtimes` EXCLUDE constraint uses
-- `date + time` (immutable) instead of the original hand-run migration's
-- `::text` round-trip (only STABLE, rejected by GIST). That original form had
-- in fact never successfully been applied to any real database — confirmed
-- via `pg_get_constraintdef` returning no rows for this constraint name on
-- the shared dev database before this migration. This is the first time it
-- actually takes effect; verified beforehand that no existing show_time rows
-- overlap (see FlywayMigrationIntegrationTest / this migration's PR).

ALTER TABLE show_time DROP CONSTRAINT IF EXISTS no_overlapping_showtimes;

ALTER TABLE show_time ADD CONSTRAINT no_overlapping_showtimes
    EXCLUDE USING GIST (
        cinema_room_id WITH =,
        (daterange(show_date, show_date, '[]')) WITH &&,
        (tsrange(show_date + start_time, show_date + end_time)) WITH &&
    )
    WHERE (status NOT IN ('CANCELLED'));
