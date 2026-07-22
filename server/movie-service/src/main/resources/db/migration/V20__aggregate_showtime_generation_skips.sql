-- Keep rejection diagnostics compact: one row per run/movie/cluster/reason.

ALTER TABLE showtime_generation_skip
    ADD COLUMN IF NOT EXISTS occurrence_count INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TEMP TABLE tmp_showtime_generation_skip_aggregate AS
SELECT
    generation_run_id,
    movie_id,
    cluster_id,
    MIN(cinema_room_id) AS cinema_room_id,
    MIN(format_id) AS format_id,
    MIN(show_date) AS show_date,
    MIN(start_time) AS start_time,
    reason,
    MIN(detail) AS detail,
    SUM(occurrence_count)::INTEGER AS occurrence_count,
    MIN(created_at) AS created_at,
    MAX(updated_at) AS updated_at
FROM showtime_generation_skip
GROUP BY generation_run_id, movie_id, cluster_id, reason;

DELETE FROM showtime_generation_skip;

INSERT INTO showtime_generation_skip (
    generation_run_id, movie_id, cluster_id, cinema_room_id, format_id,
    show_date, start_time, reason, detail, occurrence_count, created_at, updated_at
)
SELECT
    generation_run_id, movie_id, cluster_id, cinema_room_id, format_id,
    show_date, start_time, reason, detail, occurrence_count, created_at, updated_at
FROM tmp_showtime_generation_skip_aggregate;

ALTER TABLE showtime_generation_skip
    DROP CONSTRAINT IF EXISTS chk_showtime_generation_skip_occurrence_count;
ALTER TABLE showtime_generation_skip
    ADD CONSTRAINT chk_showtime_generation_skip_occurrence_count
        CHECK (occurrence_count > 0);

CREATE UNIQUE INDEX IF NOT EXISTS uq_generation_skip_aggregate
    ON showtime_generation_skip (generation_run_id, movie_id, cluster_id, reason);
