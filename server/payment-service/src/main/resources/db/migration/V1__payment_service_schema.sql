CREATE TABLE payment_attempt (
    payment_id VARCHAR(50) PRIMARY KEY,
    booking_id VARCHAR(50) NOT NULL,
    account_id VARCHAR(50) NOT NULL,
    provider VARCHAR(30) NOT NULL,
    provider_txn_ref VARCHAR(100) NOT NULL UNIQUE,
    provider_transaction_id VARCHAR(100),
    idempotency_key VARCHAR(120) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    amount NUMERIC(15,2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(30) NOT NULL,
    payment_url TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ,
    failure_code VARCHAR(50),
    failure_message VARCHAR(500),
    outcome_event_id VARCHAR(120),
    outcome_event_type VARCHAR(50),
    outcome_payload TEXT,
    outcome_delivered BOOLEAN NOT NULL DEFAULT FALSE,
    delivery_attempts INTEGER NOT NULL DEFAULT 0,
    next_delivery_at TIMESTAMPTZ,
    last_delivery_error VARCHAR(1000),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_payment_attempt_owner_idempotency UNIQUE (account_id, idempotency_key)
);

CREATE INDEX idx_payment_attempt_booking ON payment_attempt(booking_id, created_at DESC);
CREATE INDEX idx_payment_attempt_delivery ON payment_attempt(outcome_delivered, next_delivery_at);

CREATE TABLE payment_event_inbox (
    inbox_id BIGSERIAL PRIMARY KEY,
    provider VARCHAR(30) NOT NULL,
    event_key VARCHAR(160) NOT NULL,
    payment_id VARCHAR(50),
    payload_hash VARCHAR(64) NOT NULL,
    raw_payload TEXT NOT NULL,
    processing_status VARCHAR(30) NOT NULL,
    response_code VARCHAR(10),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_payment_event_provider_key UNIQUE (provider, event_key),
    CONSTRAINT fk_payment_event_attempt FOREIGN KEY (payment_id)
        REFERENCES payment_attempt(payment_id)
);

CREATE TABLE payment_reconciliation_case (
    case_id BIGSERIAL PRIMARY KEY,
    payment_id VARCHAR(50) NOT NULL,
    booking_id VARCHAR(50) NOT NULL,
    case_type VARCHAR(80) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL,
    details VARCHAR(2000) NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ,
    CONSTRAINT fk_payment_reconciliation_attempt FOREIGN KEY (payment_id)
        REFERENCES payment_attempt(payment_id)
);

CREATE INDEX idx_payment_reconciliation_status
    ON payment_reconciliation_case(status, next_attempt_at);
