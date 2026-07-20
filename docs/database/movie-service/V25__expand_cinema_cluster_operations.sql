-- Production-oriented cinema-cluster profile (Sections 1-4).
-- Amenities are intentionally out of scope.

ALTER TABLE cinema_cluster
    ADD COLUMN IF NOT EXISTS cluster_code VARCHAR(20),
    ADD COLUMN IF NOT EXISTS venue_type VARCHAR(20) NOT NULL DEFAULT 'MALL',
    ADD COLUMN IF NOT EXISTS opening_date DATE,
    ADD COLUMN IF NOT EXISTS public_email VARCHAR(150),
    ADD COLUMN IF NOT EXISTS country_code CHAR(2) NOT NULL DEFAULT 'VN',
    ADD COLUMN IF NOT EXISTS district VARCHAR(100),
    ADD COLUMN IF NOT EXISTS ward VARCHAR(100),
    ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20),
    ADD COLUMN IF NOT EXISTS building_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS floor_location VARCHAR(50),
    ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh';

UPDATE cinema_cluster
SET cluster_code = 'CP-' || LPAD(cluster_id::TEXT, 3, '0')
WHERE cluster_code IS NULL OR BTRIM(cluster_code) = '';

UPDATE cinema_cluster
SET district = CASE cluster_id
    WHEN 1 THEN 'Quận 1'
    WHEN 2 THEN 'Thành phố Thủ Đức'
    WHEN 3 THEN 'Hoàn Kiếm'
    WHEN 4 THEN 'Cầu Giấy'
    WHEN 5 THEN 'Hải Châu'
    WHEN 6 THEN 'Ninh Kiều'
    ELSE province
END
WHERE district IS NULL OR BTRIM(district) = '';

ALTER TABLE cinema_cluster
    ALTER COLUMN cluster_code SET NOT NULL,
    ALTER COLUMN district SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cluster_code_ci
    ON cinema_cluster (LOWER(cluster_code));

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cluster_venue_type') THEN
        ALTER TABLE cinema_cluster
            ADD CONSTRAINT chk_cluster_venue_type
            CHECK (venue_type IN ('MALL', 'STANDALONE', 'MIXED_USE'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS cinema_cluster_operating_hour (
    operating_hour_id BIGSERIAL PRIMARY KEY,
    cluster_id BIGINT NOT NULL REFERENCES cinema_cluster(cluster_id) ON DELETE CASCADE,
    day_of_week VARCHAR(9) NOT NULL
        CHECK (day_of_week IN ('MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY')),
    opens_at TIME,
    closes_at TIME,
    closes_next_day BOOLEAN NOT NULL DEFAULT FALSE,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_cluster_operating_day UNIQUE (cluster_id, day_of_week),
    CONSTRAINT chk_cluster_operating_time CHECK (
        (is_closed = TRUE AND opens_at IS NULL AND closes_at IS NULL AND closes_next_day = FALSE)
        OR
        (is_closed = FALSE AND opens_at IS NOT NULL AND closes_at IS NOT NULL
            AND opens_at <> closes_at
            AND (closes_next_day = TRUE OR closes_at > opens_at))
    )
);

INSERT INTO cinema_cluster_operating_hour
    (cluster_id, day_of_week, opens_at, closes_at, closes_next_day, is_closed)
SELECT cluster.cluster_id, day_name, TIME '08:00', TIME '23:00', FALSE, FALSE
FROM cinema_cluster cluster
CROSS JOIN (VALUES
    ('MONDAY'), ('TUESDAY'), ('WEDNESDAY'), ('THURSDAY'),
    ('FRIDAY'), ('SATURDAY'), ('SUNDAY')
) AS days(day_name)
ON CONFLICT (cluster_id, day_of_week) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_cluster_operating_hour_cluster
    ON cinema_cluster_operating_hour(cluster_id);
