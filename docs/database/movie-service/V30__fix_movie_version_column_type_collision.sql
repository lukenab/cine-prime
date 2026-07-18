-- V28's `ALTER TABLE movie ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL
-- DEFAULT 0` silently no-op'd on databases where a legacy `movie.version
-- VARCHAR(255)` column already existed (the pre-DB-v2 free-text screening
-- format field noted as dead in postgres-init/movie_db.sql's migration
-- comments — "version VARCHAR -> xoa, dung movie_format junction" — it was
-- never actually dropped). `IF NOT EXISTS` only checks the column name, not
-- its type, so every row kept a NULL legacy varchar instead of getting the
-- new BIGINT default. Hibernate's @Version then NPEs on first UPDATE
-- (Versioning.increment can't call .longValue() on a null current version).
--
-- Confirmed zero rows have real data in the legacy column before dropping it
-- (SELECT COUNT(*) FROM movie WHERE version IS NOT NULL AND version <> '' = 0).

ALTER TABLE movie DROP COLUMN IF EXISTS version;
ALTER TABLE movie ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
