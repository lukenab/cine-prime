ALTER TABLE movie
    ADD COLUMN IF NOT EXISTS domestic_production_verified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS programming_share_policy (
    policy_id BIGSERIAL PRIMARY KEY,
    policy_code VARCHAR(80) NOT NULL UNIQUE,
    market_code VARCHAR(10) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE NOT NULL,
    measurement_basis VARCHAR(30) NOT NULL,
    required_share NUMERIC(5,4) NOT NULL CHECK (required_share BETWEEN 0 AND 1),
    source_reference VARCHAR(500) NOT NULL,
    hard_enforcement BOOLEAN NOT NULL DEFAULT TRUE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_programming_share_policy_dates CHECK (effective_to >= effective_from),
    CONSTRAINT ck_programming_share_measurement_basis CHECK (
        measurement_basis IN ('SHOW_COUNT', 'SCREEN_MINUTES'))
);

-- Operational default only. Compliance must replace/source-control this row after legal approval.
INSERT INTO programming_share_policy (
    policy_code, market_code, effective_from, effective_to, measurement_basis,
    required_share, source_reference, hard_enforcement, active)
VALUES ('VN_PROGRAMMING_2026_V1', 'VN', DATE '2026-01-01', DATE '2026-12-31',
        'SHOW_COUNT', 0.2000, 'INTERNAL_PROGRAMMING_POLICY_REQUIRES_LEGAL_CONFIRMATION', TRUE, TRUE)
ON CONFLICT (policy_code) DO NOTHING;
