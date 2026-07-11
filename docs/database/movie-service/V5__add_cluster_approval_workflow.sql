-- =============================================================================
-- Migration V5: Cinema Cluster approval workflow + audit log
-- Run on: movie_db
-- =============================================================================

-- 1. Mở rộng cột status và CHECK constraint trên cinema_cluster
--    VARCHAR(10) → VARCHAR(20) để chứa 'PENDING_REVIEW' (14 ký tự)

ALTER TABLE cinema_cluster
    ALTER COLUMN status TYPE VARCHAR(20);

ALTER TABLE cinema_cluster
    DROP CONSTRAINT IF EXISTS chk_cluster_status;

ALTER TABLE cinema_cluster
    ADD CONSTRAINT chk_cluster_status
        CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'INACTIVE'));

-- 2. Thêm cột rejection_note (lưu lý do reject mới nhất của SUPER_ADMIN)

ALTER TABLE cinema_cluster
    ADD COLUMN IF NOT EXISTS rejection_note TEXT;

COMMENT ON COLUMN cinema_cluster.rejection_note
    IS 'Lý do reject mới nhất từ SUPER_ADMIN — null nếu chưa bị reject';

-- 3. Tạo bảng cluster_audit_log

CREATE TABLE IF NOT EXISTS cluster_audit_log (
    log_id       VARCHAR(36)   PRIMARY KEY,
    cluster_id   BIGINT        NOT NULL
                     REFERENCES cinema_cluster(cluster_id) ON DELETE CASCADE,
    action       VARCHAR(20)   NOT NULL,   -- CREATE, SUBMIT, APPROVE, REJECT, UPDATE, DEACTIVATE, REACTIVATE
    performed_by VARCHAR(255),             -- username/accountId từ JWT
    old_status   VARCHAR(20),
    new_status   VARCHAR(20),
    note         TEXT,                     -- rejection note hoặc ghi chú tự do
    timestamp    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cluster_audit_log_cluster_id
    ON cluster_audit_log(cluster_id);

CREATE INDEX IF NOT EXISTS idx_cluster_audit_log_timestamp
    ON cluster_audit_log(timestamp DESC);

COMMENT ON TABLE cluster_audit_log
    IS 'Lịch sử thay đổi trạng thái và dữ liệu của cinema cluster';
COMMENT ON COLUMN cluster_audit_log.action
    IS 'CREATE | SUBMIT | APPROVE | REJECT | UPDATE | DEACTIVATE | REACTIVATE';
