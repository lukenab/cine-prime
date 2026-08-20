CREATE TABLE workforce_outbox_event (
    event_id           VARCHAR(36) PRIMARY KEY,
    aggregate_type     VARCHAR(50) NOT NULL,
    aggregate_id       VARCHAR(36) NOT NULL,
    aggregate_version  BIGINT NOT NULL,
    event_type         VARCHAR(100) NOT NULL,
    event_version      VARCHAR(20) NOT NULL,
    correlation_id     VARCHAR(100) NOT NULL,
    causation_id       VARCHAR(100),
    partition_key      VARCHAR(100) NOT NULL,
    payload            TEXT NOT NULL,
    publish_status     VARCHAR(20) NOT NULL,
    attempt_count      INTEGER NOT NULL DEFAULT 0,
    next_attempt_at    TIMESTAMPTZ,
    occurred_at        TIMESTAMPTZ NOT NULL,
    published_at       TIMESTAMPTZ,
    last_error         TEXT
);

CREATE INDEX idx_workforce_outbox_due
    ON workforce_outbox_event(publish_status, next_attempt_at, occurred_at);
CREATE INDEX idx_workforce_outbox_aggregate
    ON workforce_outbox_event(aggregate_type, aggregate_id, aggregate_version);
