-- P0 auto-showtime hardening: configurable dayparts, start staggering and
-- explainable capacity-fit scoring. All additions are backward compatible.

ALTER TABLE showtime_allocation_policy
    ADD COLUMN IF NOT EXISTS same_movie_stagger_minutes INTEGER NOT NULL DEFAULT 20;

ALTER TABLE showtime_allocation_policy
    DROP CONSTRAINT IF EXISTS chk_same_movie_stagger_minutes;
ALTER TABLE showtime_allocation_policy
    ADD CONSTRAINT chk_same_movie_stagger_minutes
        CHECK (same_movie_stagger_minutes BETWEEN 0 AND 180);

CREATE TABLE IF NOT EXISTS showtime_daypart_policy (
    daypart_policy_id BIGSERIAL PRIMARY KEY,
    policy_id BIGINT NOT NULL
        REFERENCES showtime_allocation_policy(policy_id) ON DELETE CASCADE,
    daypart_code VARCHAR(20) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    weekday_demand_multiplier NUMERIC(5,4) NOT NULL,
    weekend_demand_multiplier NUMERIC(5,4) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_showtime_daypart_policy UNIQUE (policy_id, daypart_code),
    CONSTRAINT chk_showtime_daypart_code
        CHECK (daypart_code IN ('MORNING', 'AFTERNOON', 'EVENING', 'LATE_NIGHT')),
    CONSTRAINT chk_showtime_daypart_multiplier
        CHECK (weekday_demand_multiplier BETWEEN 0 AND 2
           AND weekend_demand_multiplier BETWEEN 0 AND 2)
);

ALTER TABLE schedule_plan_slot
    ADD COLUMN IF NOT EXISTS allocation_score NUMERIC(10,4),
    ADD COLUMN IF NOT EXISTS daypart_code VARCHAR(20),
    ADD COLUMN IF NOT EXISTS movie_demand_score NUMERIC(6,4),
    ADD COLUMN IF NOT EXISTS cluster_demand_score NUMERIC(6,4),
    ADD COLUMN IF NOT EXISTS time_demand_score NUMERIC(6,4),
    ADD COLUMN IF NOT EXISTS format_demand_score NUMERIC(6,4),
    ADD COLUMN IF NOT EXISTS capacity_fit_score NUMERIC(6,4),
    ADD COLUMN IF NOT EXISTS expected_attendance INTEGER;

ALTER TABLE schedule_plan_slot
    DROP CONSTRAINT IF EXISTS chk_schedule_plan_expected_attendance;
ALTER TABLE schedule_plan_slot
    ADD CONSTRAINT chk_schedule_plan_expected_attendance
        CHECK (expected_attendance IS NULL OR expected_attendance >= 0);

CREATE INDEX IF NOT EXISTS idx_showtime_daypart_policy_active
    ON showtime_daypart_policy(policy_id, active, start_time);
