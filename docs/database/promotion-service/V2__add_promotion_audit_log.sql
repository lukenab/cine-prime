CREATE TABLE promotion_audit_log (
    promotion_audit_log_id UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    promotion_id           UUID         NOT NULL REFERENCES promotion(promotion_id) ON DELETE RESTRICT,
    action                 VARCHAR(40)  NOT NULL,
    actor_account_id       VARCHAR(50),
    detail                 JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_promotion_audit_action
        CHECK (action IN ('CREATED', 'DRAFT_UPDATED', 'ACTIVATED', 'PAUSED', 'RETIRED'))
);

CREATE INDEX idx_promotion_audit_log_promotion_time
    ON promotion_audit_log (promotion_id, created_at DESC);
