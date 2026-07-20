-- ScreeningFormat.java has declared `status`, `createdAt`, `updatedAt` fields since at least
-- commit f60a7f5 ("refactor Movie entity layer to match DB v2 schema"), but no migration ever
-- added the matching columns to `screening_format` - V1__baseline_schema.sql created the table
-- without them. Any query that selects the full entity (e.g. Movie.formats via
-- GET /api/movies/{id}) fails with "column f1_1.created_at does not exist", breaking movie
-- detail lookups entirely. Backfills existing rows to ACTIVE/now() so nothing is left null on
-- a NOT NULL column, matching the same default the entity's @PrePersist already assumes for
-- newly-created rows.
ALTER TABLE screening_format
    ADD COLUMN IF NOT EXISTS status     VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE screening_format SET created_at = now() WHERE created_at IS NULL;
UPDATE screening_format SET updated_at = now() WHERE updated_at IS NULL;
