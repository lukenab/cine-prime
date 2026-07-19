-- [Backend] Add tagline field to Movie and MovieTranslation entities.
-- movie.tagline is the original-language tagline (mirrors movie.synopsis); movie_translation.tagline
-- is the per-locale one (mirrors movie_translation.title/synopsis). tagline_source distinguishes an
-- auto-imported TMDB tagline from a manual admin edit so a future re-sync can leave it alone -
-- same pattern as movie.trailer_source (see V5__add_movie_trailer_provenance.sql).
ALTER TABLE movie
    ADD COLUMN IF NOT EXISTS tagline VARCHAR(500),
    ADD COLUMN IF NOT EXISTS tagline_source VARCHAR(20) NOT NULL DEFAULT 'MANUAL';

ALTER TABLE movie DROP CONSTRAINT IF EXISTS chk_tagline_source;
ALTER TABLE movie ADD CONSTRAINT chk_tagline_source
    CHECK (tagline_source IN ('TMDB', 'MANUAL'));

ALTER TABLE movie_translation
    ADD COLUMN IF NOT EXISTS tagline VARCHAR(500);

COMMENT ON COLUMN movie.tagline_source IS
    'TMDB = auto-imported from TMDB movie details; MANUAL = admin-entered or admin-edited, never overwritten by a future TMDB re-sync.';
