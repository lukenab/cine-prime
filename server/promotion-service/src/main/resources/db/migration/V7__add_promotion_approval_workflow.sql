-- Introduce maker-checker approval without changing existing live promotions.
ALTER TABLE promotion
    DROP CONSTRAINT IF EXISTS chk_promotion_status;

ALTER TABLE promotion
    ADD CONSTRAINT chk_promotion_status
        CHECK (status IN (
            'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED',
            'ACTIVE', 'PAUSED', 'ARCHIVED'
        )),
    ADD COLUMN IF NOT EXISTS created_by_account_id VARCHAR(50),
    ADD COLUMN IF NOT EXISTS submitted_by_account_id VARCHAR(50),
    ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS approved_by_account_id VARCHAR(50),
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE promotion_audit_log
    DROP CONSTRAINT IF EXISTS chk_promotion_audit_action;

-- The legacy constraint only accepts RETIRED, so remove it before replacing
-- existing values with the new ARCHIVED lifecycle term.
UPDATE promotion_audit_log
SET action = 'ARCHIVED'
WHERE action = 'RETIRED';

ALTER TABLE promotion_audit_log
    ADD CONSTRAINT chk_promotion_audit_action
        CHECK (action IN (
            'CREATED', 'DRAFT_UPDATED', 'SUBMITTED', 'APPROVED', 'REJECTED',
            'ACTIVATED', 'RESUMED', 'PAUSED', 'ARCHIVED'
        ));

CREATE INDEX IF NOT EXISTS idx_promotion_approval_queue
    ON promotion (status, submitted_at)
    WHERE status = 'PENDING_APPROVAL';
