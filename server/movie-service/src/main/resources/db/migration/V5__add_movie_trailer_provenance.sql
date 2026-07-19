-- [Backend] Fetch and select an official TMDB trailer.
-- trailer_url stays the single field the rest of the app reads, but it must always be
-- rebuilt from an allow-listed provider + external key (never a raw TMDB payload URL).
-- The extra columns record where that value came from, so an admin's manual override
-- (trailer_source = 'MANUAL') is distinguishable from an auto-selected TMDB trailer
-- (trailer_source = 'TMDB') for any future re-sync to safely avoid overwriting it.
ALTER TABLE movie
    ADD COLUMN IF NOT EXISTS trailer_provider VARCHAR(20),
    ADD COLUMN IF NOT EXISTS trailer_external_key VARCHAR(50),
    ADD COLUMN IF NOT EXISTS trailer_language_code VARCHAR(10),
    ADD COLUMN IF NOT EXISTS trailer_video_type VARCHAR(20),
    ADD COLUMN IF NOT EXISTS trailer_official BOOLEAN,
    ADD COLUMN IF NOT EXISTS trailer_source VARCHAR(20) NOT NULL DEFAULT 'MANUAL';

ALTER TABLE movie DROP CONSTRAINT IF EXISTS chk_trailer_video_type;
ALTER TABLE movie ADD CONSTRAINT chk_trailer_video_type
    CHECK (trailer_video_type IS NULL OR trailer_video_type IN ('TRAILER', 'TEASER'));

ALTER TABLE movie DROP CONSTRAINT IF EXISTS chk_trailer_source;
ALTER TABLE movie ADD CONSTRAINT chk_trailer_source
    CHECK (trailer_source IN ('TMDB', 'MANUAL'));

COMMENT ON COLUMN movie.trailer_source IS
    'TMDB = auto-selected from /movie/{id}/videos on import; MANUAL = admin-entered or admin-edited, never overwritten by a future TMDB re-sync.';
