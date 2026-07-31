ALTER TABLE concession_product
    ADD COLUMN status VARCHAR(30),
    ADD COLUMN created_by VARCHAR(100),
    ADD COLUMN submitted_by VARCHAR(100),
    ADD COLUMN submitted_at TIMESTAMPTZ,
    ADD COLUMN reviewed_by VARCHAR(100),
    ADD COLUMN reviewed_at TIMESTAMPTZ,
    ADD COLUMN rejection_reason VARCHAR(500);

UPDATE concession_product
SET status = CASE WHEN active THEN 'ACTIVE' ELSE 'ARCHIVED' END,
    created_by = COALESCE(created_by, 'system-migration');

ALTER TABLE concession_product
    ALTER COLUMN status SET NOT NULL,
    ALTER COLUMN status SET DEFAULT 'DRAFT',
    ADD CONSTRAINT chk_concession_product_status
        CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'ARCHIVED'));

CREATE INDEX idx_concession_product_workflow
    ON concession_product(status, created_by, updated_at DESC);
