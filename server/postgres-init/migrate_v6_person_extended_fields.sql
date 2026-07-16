-- =============================================================================
-- CinePrime — Migration v6: Add extended fields to person (issue #153)
-- Idempotent — safe to run multiple times
-- =============================================================================

\c movie_db;

-- gender: MALE | FEMALE | NON_BINARY | UNKNOWN (nullable, String per issue #153)
ALTER TABLE person ADD COLUMN IF NOT EXISTS gender VARCHAR(10);

-- known_for_department: Acting | Directing | Writing | Production | ... (nullable)
ALTER TABLE person ADD COLUMN IF NOT EXISTS known_for_department VARCHAR(50);

-- death_date: NULL means the person is still alive
ALTER TABLE person ADD COLUMN IF NOT EXISTS death_date DATE;

ALTER TABLE person ADD COLUMN IF NOT EXISTS place_of_birth VARCHAR(255);
