CREATE TABLE IF NOT EXISTS release_plan_bulk_decision_operation (
    operation_id BIGSERIAL PRIMARY KEY,
    actor VARCHAR(100) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL,
    response_json TEXT,
    created_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    CONSTRAINT uk_release_plan_bulk_decision_actor_key UNIQUE (actor, idempotency_key),
    CONSTRAINT chk_release_plan_bulk_decision_status CHECK (status IN ('PENDING', 'COMPLETED'))
);
