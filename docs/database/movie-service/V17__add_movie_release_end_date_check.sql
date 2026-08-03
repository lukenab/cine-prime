-- MOV-03: create the release end date used by Movie.endDate, then enforce
-- releaseDate <= endDate at the database level too, not just service/DTO.
ALTER TABLE movie
    ADD COLUMN IF NOT EXISTS end_date DATE;

ALTER TABLE movie
    DROP CONSTRAINT IF EXISTS chk_movie_release_end_date;

-- NULL on either side is allowed (a movie may not have an end date yet); only an inverted
-- range with both dates present is rejected.
ALTER TABLE movie
    ADD CONSTRAINT chk_movie_release_end_date
    CHECK (release_date IS NULL OR end_date IS NULL OR release_date <= end_date);
