ALTER TABLE showtime_seat
    ADD COLUMN IF NOT EXISTS hold_id VARCHAR(36),
    ADD COLUMN IF NOT EXISTS reserved_by VARCHAR(100),
    ADD COLUMN IF NOT EXISTS hold_idempotency_key VARCHAR(128),
    ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ss_hold
    ON showtime_seat (hold_id)
    WHERE hold_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ss_hold_key
    ON showtime_seat (showtime_id, reserved_by, hold_idempotency_key)
    WHERE hold_idempotency_key IS NOT NULL;
