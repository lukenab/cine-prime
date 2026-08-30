ALTER TABLE schedule_plan
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS approved_by VARCHAR(100);

ALTER TABLE schedule_plan
    DROP CONSTRAINT IF EXISTS chk_schedule_plan_status;

ALTER TABLE schedule_plan
    ADD CONSTRAINT chk_schedule_plan_status CHECK (
        status IN (
            'DRAFT_GENERATED',
            'IN_REVIEW',
            'CHANGES_REQUESTED',
            'APPROVED',
            'PUBLISHED'
        )
    );

COMMENT ON COLUMN schedule_plan.approved_at IS
    'Independent programming approval timestamp; approval does not materialize showtimes.';
COMMENT ON COLUMN schedule_plan.approved_by IS
    'Independent programming approver. The publishing operator is recorded separately.';
