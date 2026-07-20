-- [Backend] Refactor Movie.company to support multiple production companies (ManyToMany).
-- TMDB returns several production companies per title but Movie only ever kept the first one
-- (movie.company_id). This introduces a proper junction table, backfills the existing single
-- association into it, then retires movie.company_id - and gives ProductionCompany a stable
-- external identity (tmdb_company_id) so upsert no longer depends on an exact/case-sensitive
-- name match.

CREATE TABLE IF NOT EXISTS movie_production_company (
    movie_id   BIGINT NOT NULL REFERENCES movie(movie_id) ON DELETE CASCADE,
    company_id BIGINT NOT NULL REFERENCES production_company(company_id) ON DELETE RESTRICT,
    PRIMARY KEY (movie_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_movie_production_company_company ON movie_production_company(company_id);

-- Backfill the existing single-company association before the column is retired. Guarded so
-- this is a safe no-op the second time this migration runs against an already-migrated schema
-- (movie.company_id will no longer exist by then).
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'movie' AND column_name = 'company_id'
    ) THEN
        INSERT INTO movie_production_company (movie_id, company_id)
        SELECT movie_id, company_id FROM movie WHERE company_id IS NOT NULL
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

ALTER TABLE movie DROP COLUMN IF EXISTS company_id;

-- Stable external identity for upsert - matching TMDB's company id is preferred over the
-- previous exact/case-sensitive name lookup, which could create duplicate rows for the same
-- real-world company (renamed, re-cased, punctuation variants, etc).
ALTER TABLE production_company ADD COLUMN IF NOT EXISTS tmdb_company_id INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS uq_production_company_tmdb_id
    ON production_company(tmdb_company_id)
    WHERE tmdb_company_id IS NOT NULL;

COMMENT ON COLUMN production_company.tmdb_company_id IS
    'TMDB company id - primary upsert identity for TMDB-sourced companies. Null for companies created manually via the admin UI with no known TMDB equivalent.';
