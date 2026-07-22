-- Auto Showtime database foundation (issue 1).
-- screening_format and movie_format stay canonical: do not introduce a new
-- format enum/string for room capability or movie support.

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

-- Candidate lookup starts from a selected format, then only enabled rooms.
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
    -- Reserved for the future metric aggregation job; intentionally nullable now.
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

DROP TRIGGER IF EXISTS trg_cinema_cluster_demand_profile_updated_at
    ON cinema_cluster_demand_profile;
CREATE TRIGGER trg_cinema_cluster_demand_profile_updated_at
    BEFORE UPDATE ON cinema_cluster_demand_profile
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS showtime_allocation_policy (
    policy_id BIGSERIAL PRIMARY KEY,
    policy_code VARCHAR(50) NOT NULL UNIQUE,
    -- peak_demand_weight is a multiplier; the five score weights sum to 1.
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

DROP TRIGGER IF EXISTS trg_showtime_allocation_policy_updated_at
    ON showtime_allocation_policy;
CREATE TRIGGER trg_showtime_allocation_policy_updated_at
    BEFORE UPDATE ON showtime_allocation_policy
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE showtime_allocation_policy IS
    'Named configuration read by the allocation service. Java must not special-case cluster names or IDs.';

-- Simulated deadline seed. Q9 and Long An are ordinary data, never engine conditions.
INSERT INTO cinema_cluster
    (cluster_code, cluster_name, venue_type, country_code, province, address,
     phone_number, status, latitude, longitude, timezone, created_by, updated_by)
VALUES
    ('CP-Q9', 'CinePrime Vincom Grand Park', 'MALL', 'VN', 'TP. Ho Chi Minh',
     'Vincom Mega Mall Grand Park, District 9', '19001000', 'ACTIVE',
     10.8413000, 106.8274000, 'Asia/Ho_Chi_Minh', 'migration:V35', 'migration:V35'),
    ('CP-LA', 'CinePrime Long An', 'MALL', 'VN', 'Long An',
     '1 National Route 1A, Tan An', '19001000', 'ACTIVE',
     10.5359000, 106.4137000, 'Asia/Ho_Chi_Minh', 'migration:V35', 'migration:V35')
ON CONFLICT DO NOTHING;

INSERT INTO cinema_cluster_demand_profile
    (cluster_id, demand_tier, demand_score, min_daily_shows,
     max_daily_shows_per_movie, created_by, updated_by)
SELECT cluster_id, demand_tier, demand_score, min_daily_shows,
       max_daily_shows_per_movie, 'migration:V35', 'migration:V35'
FROM (
    VALUES
        ('CP-Q9', 'HIGH', 90.00::NUMERIC, 3, 12),
        ('CP-LA', 'LOW', 25.00::NUMERIC, 1, 3)
) AS seed(cluster_code, demand_tier, demand_score, min_daily_shows, max_daily_shows_per_movie)
JOIN cinema_cluster cluster ON LOWER(cluster.cluster_code) = LOWER(seed.cluster_code)
ON CONFLICT (cluster_id) DO UPDATE
SET demand_tier = EXCLUDED.demand_tier,
    demand_score = EXCLUDED.demand_score,
    min_daily_shows = EXCLUDED.min_daily_shows,
    max_daily_shows_per_movie = EXCLUDED.max_daily_shows_per_movie,
    updated_by = EXCLUDED.updated_by;

-- Minimal capability seed for acceptance tests. Eligibility still comes only
-- from cinema_room_format, never room_type / supports_2d / supports_3d.
INSERT INTO cinema_room
    (cinema_room_name, room_code, room_type, presentation_system,
     total_seat_capacity, status, cluster_id, number_of_rows, seats_per_row,
     standard_row_count, vip_row_count, couple_row_count, created_by, updated_by)
SELECT seed.cinema_room_name, seed.room_code, seed.room_type,
       seed.presentation_system, seed.total_seat_capacity, 'ACTIVE',
       cluster.cluster_id, seed.number_of_rows, seed.seats_per_row,
       seed.standard_row_count, seed.vip_row_count, seed.couple_row_count,
       'migration:V35', 'migration:V35'
FROM (
    VALUES
        ('CP-Q9', 'IMAX 01', 'Q9-IMAX-01', 'IMAX', 'IMAX', 220, 10, 22, 8, 2, 0),
        ('CP-LA', 'Standard 01', 'LA-STD-01', 'STANDARD', 'STANDARD', 100, 10, 10, 8, 2, 0)
) AS seed(cluster_code, cinema_room_name, room_code, room_type, presentation_system,
          total_seat_capacity, number_of_rows, seats_per_row,
          standard_row_count, vip_row_count, couple_row_count)
JOIN cinema_cluster cluster ON LOWER(cluster.cluster_code) = LOWER(seed.cluster_code)
WHERE NOT EXISTS (
    SELECT 1 FROM cinema_room room
    WHERE room.cluster_id = cluster.cluster_id
      AND room.cinema_room_name = seed.cinema_room_name
);

INSERT INTO cinema_room_format
    (cinema_room_id, format_id, enabled, created_by, updated_by)
SELECT room.cinema_room_id, format.format_id, TRUE, 'migration:V35', 'migration:V35'
FROM (
    VALUES
        ('CP-Q9', 'IMAX 01', '2D'),
        ('CP-Q9', 'IMAX 01', '3D'),
        ('CP-Q9', 'IMAX 01', 'IMAX'),
        ('CP-LA', 'Standard 01', '2D')
) AS seed(cluster_code, cinema_room_name, format_code)
JOIN cinema_cluster cluster ON LOWER(cluster.cluster_code) = LOWER(seed.cluster_code)
JOIN cinema_room room ON room.cluster_id = cluster.cluster_id
    AND room.cinema_room_name = seed.cinema_room_name
JOIN screening_format format ON format.format_code = seed.format_code
ON CONFLICT (cinema_room_id, format_id) DO UPDATE
SET enabled = EXCLUDED.enabled,
    updated_by = EXCLUDED.updated_by;

INSERT INTO showtime_allocation_policy
    (policy_code, peak_demand_weight, movie_demand_weight, cluster_demand_weight,
     time_slot_demand_weight, format_demand_weight, room_capacity_weight,
     minimum_coverage, maximum_room_share, active, created_by, updated_by)
VALUES
    ('DEFAULT', 1.2000, 0.4000, 0.2500, 0.1500, 0.1000, 0.1000,
     1, 0.6000, TRUE, 'migration:V35', 'migration:V35')
ON CONFLICT (policy_code) DO UPDATE
SET peak_demand_weight = EXCLUDED.peak_demand_weight,
    movie_demand_weight = EXCLUDED.movie_demand_weight,
    cluster_demand_weight = EXCLUDED.cluster_demand_weight,
    time_slot_demand_weight = EXCLUDED.time_slot_demand_weight,
    format_demand_weight = EXCLUDED.format_demand_weight,
    room_capacity_weight = EXCLUDED.room_capacity_weight,
    minimum_coverage = EXCLUDED.minimum_coverage,
    maximum_room_share = EXCLUDED.maximum_room_share,
    active = EXCLUDED.active,
    updated_by = EXCLUDED.updated_by;
