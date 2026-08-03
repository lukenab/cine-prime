-- "Exclude specific rooms from a single auto-schedule generation run" (per-run only, not a
-- room status change). Same join-table shape as showtime_generation_run_movie/_cluster.

CREATE TABLE IF NOT EXISTS showtime_generation_run_excluded_room (
    generation_run_id BIGINT NOT NULL REFERENCES showtime_generation_run(generation_run_id) ON DELETE CASCADE,
    cinema_room_id BIGINT NOT NULL REFERENCES cinema_room(cinema_room_id) ON DELETE RESTRICT,
    PRIMARY KEY (generation_run_id, cinema_room_id)
);
