-- MOV-LC-03: additive schema only. The movie.status CHECK constraint still
-- allows the legacy exhibition values here — this repo's live movie table has
-- existing COMING_SOON/NOW_SHOWING/ENDED rows, so tightening the constraint
-- before those rows are backfilled would break this migration outright.
-- V29 does the backfill and only then swaps the constraint. Nothing in this
-- file changes movie.status values or removes columns other rows still use.
-- See docs/api-specs/movie-service/MOVIE_LIFECYCLE_CONTRACT.md for the contract.

-- ── 1. movie: optimistic locking column only (status/constraint untouched here) ─

ALTER TABLE movie ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

-- ── 2. movie_status_history: audit trail for content transitions ───────────

CREATE TABLE IF NOT EXISTS movie_status_history (
    history_id   BIGSERIAL     PRIMARY KEY,
    movie_id     BIGINT        NOT NULL REFERENCES movie(movie_id) ON DELETE CASCADE,
    from_status  VARCHAR(20)   NULL,
    to_status    VARCHAR(20)   NOT NULL,
    actor        VARCHAR(100)  NOT NULL,
    reason       VARCHAR(500)  NULL,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_movie_status_history_movie ON movie_status_history(movie_id, created_at);

-- ── 3. movie_availability: per-cluster exhibition/release plan ─────────────

CREATE TABLE IF NOT EXISTS movie_availability (
    availability_id     BIGSERIAL     PRIMARY KEY,
    movie_id             BIGINT        NOT NULL REFERENCES movie(movie_id) ON DELETE CASCADE,
    cluster_id           BIGINT        NOT NULL REFERENCES cinema_cluster(cluster_id),
    status                VARCHAR(20)   NOT NULL DEFAULT 'PLANNED'
                          CONSTRAINT chk_availability_status
                              CHECK (status IN ('PLANNED', 'OPEN', 'SUSPENDED', 'CLOSED')),
    sales_start_at        TIMESTAMPTZ   NULL,
    showing_start_date    DATE          NOT NULL,
    showing_end_date      DATE          NULL,
    suspension_reason     VARCHAR(500)  NULL,
    version               BIGINT        NOT NULL DEFAULT 0,
    created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_by            VARCHAR(100)  NULL,
    updated_by            VARCHAR(100)  NULL,
    CONSTRAINT chk_availability_date_range
        CHECK (showing_end_date IS NULL OR showing_end_date >= showing_start_date),
    CONSTRAINT uq_availability_window UNIQUE (movie_id, cluster_id, showing_start_date)
);
CREATE INDEX IF NOT EXISTS idx_movie_availability_cluster_status
    ON movie_availability(cluster_id, status, showing_start_date);
CREATE INDEX IF NOT EXISTS idx_movie_availability_movie_cluster
    ON movie_availability(movie_id, cluster_id);

CREATE TRIGGER trg_movie_availability_updated_at
    BEFORE UPDATE ON movie_availability
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 4. movie_availability_history: audit trail for availability transitions ─

CREATE TABLE IF NOT EXISTS movie_availability_history (
    history_id       BIGSERIAL     PRIMARY KEY,
    availability_id   BIGINT        NOT NULL REFERENCES movie_availability(availability_id) ON DELETE CASCADE,
    from_status       VARCHAR(20)   NULL,
    to_status         VARCHAR(20)   NOT NULL,
    actor             VARCHAR(100)  NOT NULL,
    reason            VARCHAR(500)  NULL,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_movie_availability_history_availability
    ON movie_availability_history(availability_id, created_at);
