-- `movie_image` was created by hand (server/postgres-init/migrate_v3_images_persons.sql)
-- before Flyway existed and was missed when V1's baseline was assembled — a genuinely
-- fresh Flyway-only database would never get this table without this migration.
--
-- Adds per-image provenance/metadata needed for selective TMDB poster/backdrop/still
-- import: source + external_path (TMDB's file_path) let re-import detect duplicates
-- instead of blindly re-inserting the same asset; language/width/height/aspect_ratio
-- support locale- and resolution-aware selection; is_default marks the recommended
-- pick per image_type.

CREATE TABLE IF NOT EXISTS movie_image (
    image_id      SERIAL        PRIMARY KEY,
    movie_id      INTEGER       NOT NULL REFERENCES movie(movie_id) ON DELETE CASCADE,
    image_url     VARCHAR(500)  NOT NULL,
    image_type    VARCHAR(30)   NOT NULL DEFAULT 'STILL',
    display_order INTEGER,
    caption       VARCHAR(255),
    created_at    TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movie_image_movie ON movie_image(movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_image_order ON movie_image(movie_id, display_order);

ALTER TABLE movie_image DROP CONSTRAINT IF EXISTS chk_image_type;
ALTER TABLE movie_image ADD CONSTRAINT chk_image_type
    CHECK (image_type IN ('POSTER','BACKDROP','STILL','PROMOTIONAL','LOGO'));

ALTER TABLE movie_image
    ADD COLUMN IF NOT EXISTS source        VARCHAR(30),
    ADD COLUMN IF NOT EXISTS external_path VARCHAR(500),
    ADD COLUMN IF NOT EXISTS language_code VARCHAR(10),
    ADD COLUMN IF NOT EXISTS width         INTEGER,
    ADD COLUMN IF NOT EXISTS height        INTEGER,
    ADD COLUMN IF NOT EXISTS aspect_ratio  DECIMAL(6,3),
    ADD COLUMN IF NOT EXISTS is_default    BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN movie_image.source IS 'TMDB | MANUAL | CLOUDINARY - where this asset came from';
COMMENT ON COLUMN movie_image.external_path IS 'Upstream provider''s own path/id for this asset (e.g. TMDB file_path). Combined with source + movie_id, prevents duplicate re-import';
COMMENT ON COLUMN movie_image.is_default IS 'The recommended/primary pick for this image_type at import time (e.g. the chosen poster)';

-- Only enforced when both fields are present - manually-added images (source/external_path
-- both null) are never deduped by this constraint, only provider-sourced ones.
CREATE UNIQUE INDEX IF NOT EXISTS uq_movie_image_source_path
    ON movie_image(movie_id, source, external_path)
    WHERE source IS NOT NULL AND external_path IS NOT NULL;
