ALTER TABLE cinema_cluster
    ADD COLUMN IF NOT EXISTS cover_image_url VARCHAR(1000);

COMMENT ON COLUMN cinema_cluster.cover_image_url IS
    'Public cover image URL used on cinema-cluster listing and detail screens';
