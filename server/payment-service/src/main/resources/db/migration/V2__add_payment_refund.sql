CREATE TABLE payment_refund (
    refund_id VARCHAR(50) PRIMARY KEY,
    payment_id VARCHAR(50) NOT NULL,
    booking_id VARCHAR(50) NOT NULL,
    payment_reference VARCHAR(100) NOT NULL,
    provider_refund_reference VARCHAR(100) UNIQUE,
    idempotency_key VARCHAR(120) NOT NULL UNIQUE,
    request_hash VARCHAR(64) NOT NULL,
    amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL,
    reason_code VARCHAR(100) NOT NULL,
    reason VARCHAR(500),
    status VARCHAR(30) NOT NULL,
    failure_code VARCHAR(50),
    failure_message VARCHAR(500),
    completed_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payment_refund_attempt FOREIGN KEY (payment_id)
        REFERENCES payment_attempt(payment_id)
);

CREATE INDEX idx_payment_refund_booking
    ON payment_refund(booking_id, created_at DESC);
CREATE INDEX idx_payment_refund_status
    ON payment_refund(status, created_at);
