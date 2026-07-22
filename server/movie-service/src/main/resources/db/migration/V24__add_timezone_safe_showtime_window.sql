-- Expand phase: introduce timezone-safe instants while keeping legacy date/time
-- columns for the compatibility window used by older clients.
ALTER TABLE show_time
    ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ;

-- Interpret legacy local values in the cinema cluster's business timezone.
UPDATE show_time st
SET start_at = (st.show_date + st.start_time) AT TIME ZONE COALESCE(cc.timezone, 'Asia/Ho_Chi_Minh'),
    end_at = (
        st.show_date
        + CASE WHEN st.end_time <= st.start_time THEN INTERVAL '1 day' ELSE INTERVAL '0 day' END
        + st.end_time
    ) AT TIME ZONE COALESCE(cc.timezone, 'Asia/Ho_Chi_Minh')
FROM cinema_room cr
JOIN cinema_cluster cc ON cc.cluster_id = cr.cluster_id
WHERE st.cinema_room_id = cr.cinema_room_id
  AND (st.start_at IS NULL OR st.end_at IS NULL);

ALTER TABLE show_time
    ALTER COLUMN start_at SET NOT NULL,
    ALTER COLUMN end_at SET NOT NULL;

ALTER TABLE show_time DROP CONSTRAINT IF EXISTS chk_showtime_start_end_at;
ALTER TABLE show_time
    ADD CONSTRAINT chk_showtime_start_end_at CHECK (end_at > start_at);

-- The old check prevented overnight sessions. It is no longer authoritative.
ALTER TABLE show_time DROP CONSTRAINT IF EXISTS chk_showtime_times;

CREATE INDEX IF NOT EXISTS idx_showtime_start_at ON show_time(start_at);
CREATE INDEX IF NOT EXISTS idx_showtime_room_start_at
    ON show_time(cinema_room_id, start_at);

-- Use a half-open interval so a showtime may start exactly when the previous
-- one ends. Turnaround/cleanup is validated by the scheduling policy layer.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE show_time DROP CONSTRAINT IF EXISTS no_overlapping_showtimes;
ALTER TABLE show_time
    ADD CONSTRAINT no_overlapping_showtimes
    EXCLUDE USING gist (
        cinema_room_id WITH =,
        tstzrange(start_at, end_at, '[)') WITH &&
    ) WHERE (status <> 'CANCELLED');

