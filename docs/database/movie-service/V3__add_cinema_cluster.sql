-- =============================================================================
-- Migration V3: Add cinema_cluster table + FK on cinema_room
-- Run on: movie_db
-- =============================================================================

-- 1. CINEMA CLUSTER
CREATE TABLE IF NOT EXISTS cinema_cluster (
    cluster_id    BIGSERIAL     PRIMARY KEY,
    cluster_name  VARCHAR(100)  NOT NULL,
    province      VARCHAR(100)  NOT NULL,
    address       VARCHAR(255)  NOT NULL,
    phone_number  VARCHAR(20),
    status        VARCHAR(10)   NOT NULL DEFAULT 'ACTIVE'
                  CONSTRAINT chk_cluster_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_cinema_cluster_updated_at
    BEFORE UPDATE ON cinema_cluster
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE  cinema_cluster IS 'Cụm rạp chiếu phim theo địa điểm/thành phố';
COMMENT ON COLUMN cinema_cluster.province IS 'Tỉnh/thành phố: Hà Nội, TP. Hồ Chí Minh, Đà Nẵng…';

-- 2. FK: cinema_room → cinema_cluster (nullable để không break dữ liệu cũ)
ALTER TABLE cinema_room
    ADD COLUMN IF NOT EXISTS cluster_id BIGINT
        REFERENCES cinema_cluster(cluster_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cinema_room_cluster ON cinema_room(cluster_id);

-- 3. Seed data — 6 cluster mẫu (khớp với MOCK_CLUSTERS trong frontend)
INSERT INTO cinema_cluster (cluster_id, cluster_name, province, address, phone_number, status) VALUES
    (1, 'CinePrime Quận 1',    'TP. Hồ Chí Minh', '123 Nguyễn Huệ, Quận 1',        '028 3822 1234', 'ACTIVE'),
    (2, 'CinePrime Thủ Đức',   'TP. Hồ Chí Minh', '456 Võ Văn Ngân, TP. Thủ Đức',  '028 3896 5678', 'ACTIVE'),
    (3, 'CinePrime Hoàn Kiếm', 'Hà Nội',           '78 Hàng Bài, Hoàn Kiếm',        '024 3936 9012', 'ACTIVE'),
    (4, 'CinePrime Cầu Giấy',  'Hà Nội',           '22 Xuân Thủy, Cầu Giấy',        '024 3768 3456', 'ACTIVE'),
    (5, 'CinePrime Hải Châu',  'Đà Nẵng',          '30 Trần Phú, Hải Châu',         '0236 382 7890', 'ACTIVE'),
    (6, 'CinePrime Ninh Kiều', 'Cần Thơ',          '15 Hai Bà Trưng, Ninh Kiều',    '0292 381 2345', 'INACTIVE')
ON CONFLICT (cluster_id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('cinema_cluster', 'cluster_id'), 6, true);

-- 4. Gán 4 phòng hiện có vào cluster 1 (TP.HCM Q1) để có dữ liệu mẫu
UPDATE cinema_room SET cluster_id = 1 WHERE cluster_id IS NULL;
