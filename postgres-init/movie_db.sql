-- =============================================================================
-- movie_db — schema bootstrap
-- =============================================================================
-- Schema and reference-data seeding are no longer built here. movie-service
-- now owns its own schema via Flyway (server/movie-service/src/main/resources/
-- db/migration/V1__baseline_schema.sql + R__seed_reference_data.sql), which
-- runs automatically the first time movie-service connects to this database.
--
-- This file's only remaining job is to make sure a fresh Postgres container
-- has the `movie_db` database ready and the extension movie-service's schema
-- needs available before Flyway runs (extensions require a role movie-service
-- itself may not have in every environment, so it's created here once,
-- up front, rather than inside the Flyway migration).
--
-- The full hand-authored schema this file used to contain (mirroring
-- docs/database/movie-service/V3-V34) has moved into the Flyway migration
-- above — see docs/database/movie-service/README.md for why it was
-- consolidated into one baseline instead of replayed as 30+ separate
-- versions.

\c movie_db;

CREATE EXTENSION IF NOT EXISTS btree_gist;
