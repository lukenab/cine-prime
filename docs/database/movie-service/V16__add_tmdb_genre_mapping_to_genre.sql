-- TMDB-FIX-03: stop silently dropping unmapped TMDB genres.
-- Adds a stable external identity (tmdb_genre_id) so genre matching no longer relies solely on
-- an in-memory Map<Integer,String> + case-insensitive name fallback, plus a status column so
-- genres auto-created from an unmapped TMDB genre start as PENDING_REVIEW, not ACTIVE.

ALTER TABLE genre
    ADD COLUMN IF NOT EXISTS tmdb_genre_id INTEGER NULL;

-- Postgres UNIQUE allows multiple NULLs, so genres without a known TMDB id are unaffected.
ALTER TABLE genre
    ADD CONSTRAINT uk_genre_tmdb_genre_id UNIQUE (tmdb_genre_id);

ALTER TABLE genre
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

-- Backfill existing seed genres (see data.sql) with their known TMDB genre id, mirroring
-- TmdbService.TMDB_GENRE_CODES. Genres with no TMDB equivalent (e.g. 'biography') are left NULL.
UPDATE genre SET tmdb_genre_id = 28    WHERE genre_code = 'action'     AND tmdb_genre_id IS NULL;
UPDATE genre SET tmdb_genre_id = 12    WHERE genre_code = 'adventure'  AND tmdb_genre_id IS NULL;
UPDATE genre SET tmdb_genre_id = 16    WHERE genre_code = 'animation'  AND tmdb_genre_id IS NULL;
UPDATE genre SET tmdb_genre_id = 35    WHERE genre_code = 'comedy'     AND tmdb_genre_id IS NULL;
UPDATE genre SET tmdb_genre_id = 80    WHERE genre_code = 'crime'      AND tmdb_genre_id IS NULL;
UPDATE genre SET tmdb_genre_id = 18    WHERE genre_code = 'drama'      AND tmdb_genre_id IS NULL;
UPDATE genre SET tmdb_genre_id = 10751 WHERE genre_code = 'family'     AND tmdb_genre_id IS NULL;
UPDATE genre SET tmdb_genre_id = 14    WHERE genre_code = 'fantasy'    AND tmdb_genre_id IS NULL;
UPDATE genre SET tmdb_genre_id = 36    WHERE genre_code = 'history'    AND tmdb_genre_id IS NULL;
UPDATE genre SET tmdb_genre_id = 27    WHERE genre_code = 'horror'     AND tmdb_genre_id IS NULL;
UPDATE genre SET tmdb_genre_id = 9648  WHERE genre_code = 'mystery'    AND tmdb_genre_id IS NULL;
UPDATE genre SET tmdb_genre_id = 10749 WHERE genre_code = 'romance'    AND tmdb_genre_id IS NULL;
UPDATE genre SET tmdb_genre_id = 878   WHERE genre_code = 'sci-fi'     AND tmdb_genre_id IS NULL;
UPDATE genre SET tmdb_genre_id = 53    WHERE genre_code = 'thriller'   AND tmdb_genre_id IS NULL;
