CREATE TABLE IF NOT EXISTS seat_hold_rate_window (
    dimension_type VARCHAR(20) NOT NULL,
    dimension_key VARCHAR(160) NOT NULL,
    window_epoch BIGINT NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (dimension_type, dimension_key, window_epoch)
);

CREATE INDEX IF NOT EXISTS idx_seat_hold_rate_updated_at
    ON seat_hold_rate_window (updated_at);

CREATE TABLE IF NOT EXISTS seat_inventory_outbox (
    event_id UUID PRIMARY KEY,
    event_type VARCHAR(40) NOT NULL,
    aggregate_type VARCHAR(40) NOT NULL DEFAULT 'SHOWTIME_SEAT_HOLD',
    aggregate_id VARCHAR(100) NOT NULL,
    showtime_id BIGINT NOT NULL,
    payload TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    attempts INTEGER NOT NULL DEFAULT 0,
    occurred_at TIMESTAMP NOT NULL,
    published_at TIMESTAMP NULL,
    last_error VARCHAR(1000) NULL
);

CREATE INDEX IF NOT EXISTS idx_seat_inventory_outbox_pending
    ON seat_inventory_outbox (status, occurred_at);

