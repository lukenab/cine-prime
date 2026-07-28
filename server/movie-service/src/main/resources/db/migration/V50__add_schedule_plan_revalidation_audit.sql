ALTER TABLE schedule_plan
    ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS validated_by VARCHAR(100);

COMMENT ON COLUMN schedule_plan.validated_at IS
    'Last time the draft plan was revalidated against live scheduling resources';
COMMENT ON COLUMN schedule_plan.validated_by IS
    'Authenticated actor that requested the latest plan revalidation';
