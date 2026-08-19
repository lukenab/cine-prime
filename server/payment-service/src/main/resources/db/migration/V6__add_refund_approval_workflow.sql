CREATE TABLE refund_approval_request (
    request_id VARCHAR(50) PRIMARY KEY,
    refund_id VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    requested_by VARCHAR(50) NOT NULL,
    reviewed_by VARCHAR(50),
    executed_by VARCHAR(50),
    request_note VARCHAR(1000),
    decision_note VARCHAR(1000),
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_refund_approval_refund FOREIGN KEY (refund_id)
        REFERENCES payment_refund(refund_id)
);

CREATE INDEX idx_refund_approval_refund
    ON refund_approval_request(refund_id, created_at DESC);
CREATE INDEX idx_refund_approval_status
    ON refund_approval_request(status, created_at DESC);
CREATE UNIQUE INDEX uk_refund_approval_active
    ON refund_approval_request(refund_id)
    WHERE status IN ('DRAFT', 'SUBMITTED', 'APPROVED');
