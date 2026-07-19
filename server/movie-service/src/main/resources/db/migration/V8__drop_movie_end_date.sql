-- [Frontend] Remove exhibition end date from Movie Editor (follow-up): the frontend change kept
-- movie.end_date in the DB deliberately (see docs/issues/mr-remove-movie-editor-end-date.md and
-- MOV-P1-009 in docs/MOVIE_SERVICE_BUSINESS_RULES.md). This migration finishes the removal at
-- the backend/schema level, since the actual exhibition window lives on
-- movie_availability.showing_end_date (per cluster), not on movie itself.
ALTER TABLE movie DROP COLUMN IF EXISTS end_date;
