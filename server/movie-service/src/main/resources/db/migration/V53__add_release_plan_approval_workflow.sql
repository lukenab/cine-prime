ALTER TABLE movie_availability
    DROP CONSTRAINT IF EXISTS chk_availability_status;

ALTER TABLE movie_availability
    ADD CONSTRAINT chk_availability_status CHECK (
        status IN (
            'PLANNED',
            'IN_REVIEW',
            'CHANGES_REQUESTED',
            'APPROVED',
            'OPEN',
            'SUSPENDED',
            'CLOSED'
        )
    );

ALTER TABLE movie_availability
    ADD COLUMN IF NOT EXISTS review_note VARCHAR(500),
    ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS submitted_by VARCHAR(100),
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS approved_by VARCHAR(100);

COMMENT ON COLUMN movie_availability.status IS
    'Release-plan workflow: PLANNED -> IN_REVIEW -> APPROVED -> OPEN; CHANGES_REQUESTED returns to preparation';
