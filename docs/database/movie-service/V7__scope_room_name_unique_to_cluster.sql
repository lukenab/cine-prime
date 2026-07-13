-- =============================================================================
-- Migration V7: Scope cinema_room_name uniqueness to cluster level (fix #144)
-- Run on: movie_db
-- =============================================================================
-- cinema_room_name was never globally UNIQUE in this init script (only the JPA
-- entity annotation claimed so), but CinemaRoomService still enforced global
-- uniqueness in code. This adds the real DB-level constraint scoped correctly,
-- so two clusters can each have a room named e.g. "Phòng IMAX 1".

ALTER TABLE cinema_room
    ADD CONSTRAINT uq_room_name_per_cluster UNIQUE (cluster_id, cinema_room_name);
