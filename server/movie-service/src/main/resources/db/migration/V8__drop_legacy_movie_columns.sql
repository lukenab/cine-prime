-- These 10 columns predate the v1->v2 redesign documented in postgres-init/movie_db.sql
-- (lines ~152-161): actor/director were replaced by movie_cast, movie_name_vn/english by
-- movie_translation, movie_production_company (free text) by the movie_production_company
-- junction table, large_image/small_image by poster_url/thumbnail_url, content by synopsis,
-- create_at by created_at (typo fix), and duration by duration_minutes. None of them are
-- mapped on Movie (see Movie.java) or referenced anywhere else in movie-service.
ALTER TABLE movie DROP COLUMN IF EXISTS actor;
ALTER TABLE movie DROP COLUMN IF EXISTS director;
ALTER TABLE movie DROP COLUMN IF EXISTS content;
ALTER TABLE movie DROP COLUMN IF EXISTS movie_name_vn;
ALTER TABLE movie DROP COLUMN IF EXISTS movie_name_english;
ALTER TABLE movie DROP COLUMN IF EXISTS movie_production_company;
ALTER TABLE movie DROP COLUMN IF EXISTS large_image;
ALTER TABLE movie DROP COLUMN IF EXISTS small_image;
ALTER TABLE movie DROP COLUMN IF EXISTS create_at;
ALTER TABLE movie DROP COLUMN IF EXISTS duration;
