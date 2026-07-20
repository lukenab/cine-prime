-- Auto Showtime persistence foundation.

CREATE TABLE movie_scheduling_profile (
    movie_id BIGINT PRIMARY KEY REFERENCES movie(movie_id) ON DELETE CASCADE,
    popularity_score NUMERIC(5,2) NOT NULL,
    priority_override NUMERIC(5,2),
    score_source VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    last_calculated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    CONSTRAINT chk_movie_scheduling_popularity CHECK (popularity_score BETWEEN 0 AND 100),
    CONSTRAINT chk_movie_scheduling_priority_override CHECK (priority_override IS NULL OR priority_override BETWEEN 0 AND 100),
    CONSTRAINT chk_movie_scheduling_score_source CHECK (score_source IN ('MANUAL', 'TMDB', 'DERIVED'))
);

CREATE TRIGGER trg_movie_scheduling_profile_updated_at
    BEFORE UPDATE ON movie_scheduling_profile
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE showtime_allocation_policy
    ADD COLUMN planning_horizon_start_days INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN planning_horizon_end_days INTEGER NOT NULL DEFAULT 9,
    ADD COLUMN cleanup_buffer_minutes INTEGER NOT NULL DEFAULT 15,
    ADD COLUMN time_slot_interval_minutes INTEGER NOT NULL DEFAULT 15,
    ADD COLUMN business_timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    ADD COLUMN peak_start_time TIME NOT NULL DEFAULT TIME '18:00',
    ADD COLUMN peak_end_time TIME NOT NULL DEFAULT TIME '22:00';

ALTER TABLE showtime_allocation_policy
    ADD CONSTRAINT chk_allocation_policy_generation_config
    CHECK (
        planning_horizon_start_days >= 0
        AND planning_horizon_end_days >= planning_horizon_start_days
        AND cleanup_buffer_minutes BETWEEN 0 AND 120
        AND time_slot_interval_minutes BETWEEN 5 AND 60
        AND peak_end_time > peak_start_time
    );

CREATE TABLE showtime_allocation_format_priority (
    policy_id BIGINT NOT NULL REFERENCES showtime_allocation_policy(policy_id) ON DELETE CASCADE,
    format_id SMALLINT NOT NULL REFERENCES screening_format(format_id) ON DELETE RESTRICT,
    allocation_priority INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    PRIMARY KEY (policy_id, format_id),
    CONSTRAINT chk_allocation_format_priority CHECK (allocation_priority >= 0)
);

CREATE INDEX idx_allocation_format_priority
    ON showtime_allocation_format_priority(policy_id, allocation_priority DESC);

CREATE TRIGGER trg_showtime_allocation_format_priority_updated_at
    BEFORE UPDATE ON showtime_allocation_format_priority
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE showtime_generation_run (
    generation_run_id BIGSERIAL PRIMARY KEY,
    policy_id BIGINT NOT NULL REFERENCES showtime_allocation_policy(policy_id) ON DELETE RESTRICT,
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
    CONSTRAINT chk_generation_run_status CHECK (status IN ('ACCEPTED', 'RUNNING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED')),
    CONSTRAINT chk_generation_run_dates CHECK (end_date >= start_date),
    CONSTRAINT chk_generation_run_counts CHECK (candidate_count >= 0 AND created_count >= 0 AND skipped_count >= 0)
);

CREATE INDEX idx_generation_run_status_created_at
    ON showtime_generation_run(status, created_at);

CREATE TRIGGER trg_showtime_generation_run_updated_at
    BEFORE UPDATE ON showtime_generation_run
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE showtime_generation_run_movie (
    generation_run_id BIGINT NOT NULL REFERENCES showtime_generation_run(generation_run_id) ON DELETE CASCADE,
    movie_id BIGINT NOT NULL REFERENCES movie(movie_id) ON DELETE RESTRICT,
    PRIMARY KEY (generation_run_id, movie_id)
);

CREATE TABLE showtime_generation_run_cluster (
    generation_run_id BIGINT NOT NULL REFERENCES showtime_generation_run(generation_run_id) ON DELETE CASCADE,
    cluster_id BIGINT NOT NULL REFERENCES cinema_cluster(cluster_id) ON DELETE RESTRICT,
    PRIMARY KEY (generation_run_id, cluster_id)
);

CREATE TABLE showtime_generation_skip (
    skip_id BIGSERIAL PRIMARY KEY,
    generation_run_id BIGINT NOT NULL REFERENCES showtime_generation_run(generation_run_id) ON DELETE CASCADE,
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

CREATE INDEX idx_generation_skip_run_created_at
    ON showtime_generation_skip(generation_run_id, created_at);

ALTER TABLE show_time
    ADD COLUMN source VARCHAR(10) NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN generation_run_id BIGINT REFERENCES showtime_generation_run(generation_run_id) ON DELETE SET NULL,
    ADD COLUMN generation_reason VARCHAR(100);

ALTER TABLE show_time
    ADD CONSTRAINT chk_showtime_source CHECK (source IN ('MANUAL', 'AUTO'));

CREATE INDEX idx_showtime_generation_run
    ON show_time(generation_run_id)
    WHERE generation_run_id IS NOT NULL;
