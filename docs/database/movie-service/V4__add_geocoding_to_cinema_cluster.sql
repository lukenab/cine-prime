-- =============================================================================
-- Migration V4: Add geocoding fields (latitude, longitude) to cinema_cluster
-- Run on: movie_db
-- Depends on: V3__add_cinema_cluster.sql
-- =============================================================================

-- 1. Thêm 2 cột tọa độ (nullable — cluster cũ không bắt buộc có tọa độ ngay)
ALTER TABLE cinema_cluster
    ADD COLUMN IF NOT EXISTS latitude  DECIMAL(10, 7),
    ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7);

COMMENT ON COLUMN cinema_cluster.latitude  IS 'Vĩ độ — range [-90, 90], độ chính xác ~1cm';
COMMENT ON COLUMN cinema_cluster.longitude IS 'Kinh độ — range [-180, 180], độ chính xác ~1cm';

-- 2. Seed tọa độ cho 6 cluster hiện có (lấy từ Google Maps)
UPDATE cinema_cluster SET latitude = 10.7769660, longitude = 106.7009650 WHERE cluster_id = 1; -- CinePrime Quận 1
UPDATE cinema_cluster SET latitude = 10.8500000, longitude = 106.7716670 WHERE cluster_id = 2; -- CinePrime Thủ Đức
UPDATE cinema_cluster SET latitude = 21.0285110, longitude = 105.8341600 WHERE cluster_id = 3; -- CinePrime Hoàn Kiếm
UPDATE cinema_cluster SET latitude = 21.0363890, longitude = 105.7822220 WHERE cluster_id = 4; -- CinePrime Cầu Giấy
UPDATE cinema_cluster SET latitude = 16.0680000, longitude = 108.2120000 WHERE cluster_id = 5; -- CinePrime Hải Châu
UPDATE cinema_cluster SET latitude = 10.0333330, longitude = 105.7833330 WHERE cluster_id = 6; -- CinePrime Ninh Kiều
