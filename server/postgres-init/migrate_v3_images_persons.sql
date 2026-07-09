-- =============================================================================
-- CinePrime — Migration v3: movie_image table
-- Idempotent — safe to run multiple times
-- =============================================================================

\c movie_db;

-- -----------------------------------------------------------------------------
-- movie_image: gallery ảnh cho phim
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movie_image (
    image_id      SERIAL        PRIMARY KEY,
    movie_id      INTEGER       NOT NULL REFERENCES movie(movie_id) ON DELETE CASCADE,
    image_url     VARCHAR(500)  NOT NULL,
    image_type    VARCHAR(30)   NOT NULL DEFAULT 'STILL',
    display_order INTEGER,
    caption       VARCHAR(255),
    created_at    TIMESTAMPTZ   DEFAULT NOW(),

    CONSTRAINT chk_image_type CHECK (
        image_type IN ('POSTER', 'BACKDROP', 'STILL', 'PROMOTIONAL')
    )
);

CREATE INDEX IF NOT EXISTS idx_movie_image_movie  ON movie_image(movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_image_order  ON movie_image(movie_id, display_order);
