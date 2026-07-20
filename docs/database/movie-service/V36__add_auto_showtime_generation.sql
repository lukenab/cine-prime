-- Auto Showtime persistence foundation (issue 2).
-- V35 owns room capability, cluster demand and the base allocation policy.
-- This migration adds the inputs, run audit and showtime provenance required
-- by the asynchronous allocation engine.

CREATE TABLE IF NOT EXISTS movie_scheduling_profile (
    movie_id BIGINT PRIMARY KEY
        REFERENCES movie(movie_id) ON DELETE CASCADE,
    popularity_score NUMERIC(5,2) NOT NULL,
    priority_override NUMERIC(5,2),
    score_source VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    last_calculated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    CONSTRAINT chk_movie_scheduling_popularity
        CHECK (popularity_score BETWEEN 0 AND 100),
    CONSTRAINT chk_movie_scheduling_priority_override
        CHECK (priority_override IS NULL OR priority_override BETWEEN 0 AND 100),
    CONSTRAINT chk_movie_scheduling_score_source
        CHECK (score_source IN ('MANUAL', 'TMDB', 'DERIVED'))
);

DROP TRIGGER IF EXISTS trg_movie_scheduling_profile_updated_at
    ON movie_scheduling_profile;
CREATE TRIGGER trg_movie_scheduling_profile_updated_at
    BEFORE UPDATE ON movie_scheduling_profile
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE movie_scheduling_profile IS
    'Scheduling-specific popularity input. Deadline values are configured manually; future aggregation may derive them from booking metrics.';

-- The scheduler reads operational timing from policy instead of scattering
-- horizon, peak and cleanup constants across Java classes.
ALTER TABLE showtime_allocation_policy
    ADD COLUMN IF NOT EXISTS planning_horizon_start_days INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN IF NOT EXISTS planning_horizon_end_days INTEGER NOT NULL DEFAULT 9,
    ADD COLUMN IF NOT EXISTS cleanup_buffer_minutes INTEGER NOT NULL DEFAULT 15,
    ADD COLUMN IF NOT EXISTS time_slot_interval_minutes INTEGER NOT NULL DEFAULT 15,
    ADD COLUMN IF NOT EXISTS business_timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    ADD COLUMN IF NOT EXISTS peak_start_time TIME NOT NULL DEFAULT TIME '18:00',
    ADD COLUMN IF NOT EXISTS peak_end_time TIME NOT NULL DEFAULT TIME '22:00';

ALTER TABLE showtime_allocation_policy
    DROP CONSTRAINT IF EXISTS chk_allocation_policy_generation_config;
ALTER TABLE showtime_allocation_policy
    ADD CONSTRAINT chk_allocation_policy_generation_config
    CHECK (
        planning_horizon_start_days >= 0
        AND planning_horizon_end_days >= planning_horizon_start_days
        AND cleanup_buffer_minutes BETWEEN 0 AND 120
        AND time_slot_interval_minutes BETWEEN 5 AND 60
        AND peak_end_time > peak_start_time
    );

UPDATE showtime_allocation_policy
SET planning_horizon_start_days = 3,
    planning_horizon_end_days = 9,
    cleanup_buffer_minutes = 15,
    time_slot_interval_minutes = 15,
    business_timezone = 'Asia/Ho_Chi_Minh',
    peak_start_time = TIME '18:00',
    peak_end_time = TIME '22:00',
    updated_by = 'migration:V36'
WHERE policy_code = 'DEFAULT';

CREATE TABLE IF NOT EXISTS showtime_allocation_format_priority (
    policy_id BIGINT NOT NULL
        REFERENCES showtime_allocation_policy(policy_id) ON DELETE CASCADE,
    format_id SMALLINT NOT NULL
        REFERENCES screening_format(format_id) ON DELETE RESTRICT,
    allocation_priority INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    PRIMARY KEY (policy_id, format_id),
    CONSTRAINT chk_allocation_format_priority
        CHECK (allocation_priority >= 0)
);

CREATE INDEX IF NOT EXISTS idx_allocation_format_priority
    ON showtime_allocation_format_priority(policy_id, allocation_priority DESC);

DROP TRIGGER IF EXISTS trg_showtime_allocation_format_priority_updated_at
    ON showtime_allocation_format_priority;
CREATE TRIGGER trg_showtime_allocation_format_priority_updated_at
    BEFORE UPDATE ON showtime_allocation_format_priority
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Existing screening formats remain canonical. Missing optional format rows are
-- simply not seeded; the engine must not assume a format code exists.
INSERT INTO showtime_allocation_format_priority
    (policy_id, format_id, allocation_priority, created_by, updated_by)
SELECT policy.policy_id, format.format_id, seed.allocation_priority,
       'migration:V36', 'migration:V36'
FROM (
    VALUES ('IMAX', 100), ('4DX', 90), ('SCREENX', 80), ('3D', 70), ('2D', 10)
) AS seed(format_code, allocation_priority)
JOIN showtime_allocation_policy policy ON policy.policy_code = 'DEFAULT'
JOIN screening_format format ON format.format_code = seed.format_code
ON CONFLICT (policy_id, format_id) DO UPDATE
SET allocation_priority = EXCLUDED.allocation_priority,
    updated_by = EXCLUDED.updated_by;

CREATE TABLE IF NOT EXISTS showtime_generation_run (
    generation_run_id BIGSERIAL PRIMARY KEY,
    policy_id BIGINT NOT NULL
        REFERENCES showtime_allocation_policy(policy_id) ON DELETE RESTRICT,
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    status VARCHAR(24) NOT NULL DEFAULT 'ACCEPTED',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    candidate_count INTEGER NOT NULL DEFAULT 0,
    created_count INTEGER NOT NULL DEFAULT 0,
    skipped_count INTEGER NOT NULL DEFAULT 0,
    requested_by VARCHAR(100),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failure_detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_generation_run_status
        CHECK (status IN ('ACCEPTED', 'RUNNING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED')),
    CONSTRAINT chk_generation_run_dates
        CHECK (end_date >= start_date),
    CONSTRAINT chk_generation_run_counts
        CHECK (candidate_count >= 0 AND created_count >= 0 AND skipped_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_generation_run_status_created_at
    ON showtime_generation_run(status, created_at);

DROP TRIGGER IF EXISTS trg_showtime_generation_run_updated_at
    ON showtime_generation_run;
CREATE TRIGGER trg_showtime_generation_run_updated_at
    BEFORE UPDATE ON showtime_generation_run
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS showtime_generation_run_movie (
    generation_run_id BIGINT NOT NULL
        REFERENCES showtime_generation_run(generation_run_id) ON DELETE CASCADE,
    movie_id BIGINT NOT NULL
        REFERENCES movie(movie_id) ON DELETE RESTRICT,
    PRIMARY KEY (generation_run_id, movie_id)
);

CREATE TABLE IF NOT EXISTS showtime_generation_run_cluster (
    generation_run_id BIGINT NOT NULL
        REFERENCES showtime_generation_run(generation_run_id) ON DELETE CASCADE,
    cluster_id BIGINT NOT NULL
        REFERENCES cinema_cluster(cluster_id) ON DELETE RESTRICT,
    PRIMARY KEY (generation_run_id, cluster_id)
);

CREATE TABLE IF NOT EXISTS showtime_generation_skip (
    skip_id BIGSERIAL PRIMARY KEY,
    generation_run_id BIGINT NOT NULL
        REFERENCES showtime_generation_run(generation_run_id) ON DELETE CASCADE,
    movie_id BIGINT REFERENCES movie(movie_id) ON DELETE SET NULL,
    cluster_id BIGINT REFERENCES cinema_cluster(cluster_id) ON DELETE SET NULL,
    cinema_room_id BIGINT REFERENCES cinema_room(cinema_room_id) ON DELETE SET NULL,
    format_id SMALLINT REFERENCES screening_format(format_id) ON DELETE SET NULL,
    show_date DATE,
    start_time TIME,
    reason VARCHAR(100) NOT NULL,
    detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generation_skip_run_created_at
    ON showtime_generation_skip(generation_run_id, created_at);

-- Existing/manual rows become MANUAL. A generated showtime is linked to its
-- run so GET result can page persisted rows without recomputing candidates.
ALTER TABLE show_time
    ADD COLUMN IF NOT EXISTS source VARCHAR(10) NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN IF NOT EXISTS generation_run_id BIGINT
        REFERENCES showtime_generation_run(generation_run_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS generation_reason VARCHAR(100);

ALTER TABLE show_time DROP CONSTRAINT IF EXISTS chk_showtime_source;
ALTER TABLE show_time
    ADD CONSTRAINT chk_showtime_source
    CHECK (source IN ('MANUAL', 'AUTO'));

CREATE INDEX IF NOT EXISTS idx_showtime_generation_run
    ON show_time(generation_run_id)
    WHERE generation_run_id IS NOT NULL;
