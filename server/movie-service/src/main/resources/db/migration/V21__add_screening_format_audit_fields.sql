-- Keep the screening_format schema aligned with the entity used by room-format
-- and allocation-priority joins. This is additive for databases created before
-- format status/audit fields were introduced.

ALTER TABLE screening_format
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE screening_format SET created_at = NOW() WHERE created_at IS NULL;
UPDATE screening_format SET updated_at = NOW() WHERE updated_at IS NULL;

ALTER TABLE screening_format
    ALTER COLUMN created_at SET DEFAULT NOW(),
    ALTER COLUMN created_at SET NOT NULL,
    ALTER COLUMN updated_at SET DEFAULT NOW(),
    ALTER COLUMN updated_at SET NOT NULL;
