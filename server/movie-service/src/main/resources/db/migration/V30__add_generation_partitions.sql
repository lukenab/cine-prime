ALTER TABLE showtime_generation_run
    ADD COLUMN IF NOT EXISTS successful_partition_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS failed_partition_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS showtime_generation_partition (
    partition_id BIGSERIAL PRIMARY KEY,
    generation_run_id BIGINT NOT NULL REFERENCES showtime_generation_run(generation_run_id) ON DELETE CASCADE,
    cluster_id BIGINT NOT NULL REFERENCES cinema_cluster(cluster_id) ON DELETE RESTRICT,
    business_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('SUCCEEDED', 'FAILED')),
    slot_count INTEGER NOT NULL DEFAULT 0,
    failure_code VARCHAR(80),
    failure_detail TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_generation_partition_scope UNIQUE (generation_run_id, cluster_id, business_date)
);

CREATE INDEX IF NOT EXISTS idx_generation_partition_run_status
    ON showtime_generation_partition(generation_run_id, status);
