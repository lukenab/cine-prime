-- Auto Showtime database foundation.
-- screening_format and movie_format remain the canonical format catalog.

CREATE TABLE IF NOT EXISTS cinema_room_format (
    cinema_room_id BIGINT NOT NULL
        REFERENCES cinema_room(cinema_room_id) ON DELETE CASCADE,
    format_id SMALLINT NOT NULL
        REFERENCES screening_format(format_id) ON DELETE RESTRICT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    PRIMARY KEY (cinema_room_id, format_id)
);

CREATE INDEX IF NOT EXISTS idx_cinema_room_format_enabled_format
    ON cinema_room_format(format_id, cinema_room_id)
    WHERE enabled = TRUE;

DROP TRIGGER IF EXISTS trg_cinema_room_format_updated_at ON cinema_room_format;
CREATE TRIGGER trg_cinema_room_format_updated_at
    BEFORE UPDATE ON cinema_room_format
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE cinema_room_format IS
    'Explicit room capability. Room type is descriptive only and is not a showtime eligibility rule.';

CREATE TABLE IF NOT EXISTS cinema_cluster_demand_profile (
    cluster_id BIGINT PRIMARY KEY
        REFERENCES cinema_cluster(cluster_id) ON DELETE CASCADE,
    demand_tier VARCHAR(10) NOT NULL,
    demand_score NUMERIC(5,2) NOT NULL,
    min_daily_shows INTEGER NOT NULL,
    max_daily_shows_per_movie INTEGER NOT NULL,
    unique_customer_count BIGINT,
    booking_count BIGINT,
    revenue NUMERIC(14,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    CONSTRAINT chk_cluster_demand_tier
        CHECK (demand_tier IN ('HIGH', 'NORMAL', 'LOW')),
    CONSTRAINT chk_cluster_demand_score
        CHECK (demand_score BETWEEN 0 AND 100),
    CONSTRAINT chk_cluster_demand_daily_shows
        CHECK (min_daily_shows >= 0
            AND max_daily_shows_per_movie >= min_daily_shows),
    CONSTRAINT chk_cluster_demand_future_metrics
        CHECK ((unique_customer_count IS NULL OR unique_customer_count >= 0)
            AND (booking_count IS NULL OR booking_count >= 0)
            AND (revenue IS NULL OR revenue >= 0))
);

DROP TRIGGER IF EXISTS trg_cinema_cluster_demand_profile_updated_at ON cinema_cluster_demand_profile;
CREATE TRIGGER trg_cinema_cluster_demand_profile_updated_at
    BEFORE UPDATE ON cinema_cluster_demand_profile
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS showtime_allocation_policy (
    policy_id BIGSERIAL PRIMARY KEY,
    policy_code VARCHAR(50) NOT NULL UNIQUE,
    peak_demand_weight NUMERIC(6,4) NOT NULL,
    movie_demand_weight NUMERIC(6,4) NOT NULL,
    cluster_demand_weight NUMERIC(6,4) NOT NULL,
    time_slot_demand_weight NUMERIC(6,4) NOT NULL,
    format_demand_weight NUMERIC(6,4) NOT NULL,
    room_capacity_weight NUMERIC(6,4) NOT NULL,
    minimum_coverage INTEGER NOT NULL,
    maximum_room_share NUMERIC(5,4) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    CONSTRAINT chk_allocation_policy_non_negative
        CHECK (peak_demand_weight >= 0
            AND movie_demand_weight >= 0
            AND cluster_demand_weight >= 0
            AND time_slot_demand_weight >= 0
            AND format_demand_weight >= 0
            AND room_capacity_weight >= 0),
    CONSTRAINT chk_allocation_policy_score_weight_total
        CHECK (movie_demand_weight + cluster_demand_weight
            + time_slot_demand_weight + format_demand_weight
            + room_capacity_weight = 1.0000),
    CONSTRAINT chk_allocation_policy_quota
        CHECK (minimum_coverage >= 0
            AND maximum_room_share > 0
            AND maximum_room_share <= 1)
);

DROP TRIGGER IF EXISTS trg_showtime_allocation_policy_updated_at ON showtime_allocation_policy;
CREATE TRIGGER trg_showtime_allocation_policy_updated_at
    BEFORE UPDATE ON showtime_allocation_policy
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE showtime_allocation_policy IS
    'Named configuration read by the allocation service. Java must not special-case cluster names or IDs.';
