-- =============================================================================
-- CinePrime — Migration v16: Normalize movie_image enum and update constraint
-- =============================================================================

\c movie_db;

DO $$
DECLARE
    invalid_count INT;
BEGIN
    -- 1. Normalize existing data (trim and uppercase)
    UPDATE movie_image 
    SET image_type = UPPER(TRIM(image_type));
    
    -- 2. Audit remaining invalid values
    SELECT COUNT(*) INTO invalid_count 
    FROM movie_image 
    WHERE image_type NOT IN ('POSTER', 'BACKDROP', 'STILL', 'PROMOTIONAL', 'LOGO');
    
    -- 3. Fail migration if invalid values exist to prevent silent data loss
    IF invalid_count > 0 THEN
        RAISE EXCEPTION 'Found % invalid image_type records after normalization. Migration aborted. Please manually audit and fix legacy values before applying this migration.', invalid_count;
    END IF;
    
    -- 4. Drop old check constraint if it exists
    ALTER TABLE movie_image DROP CONSTRAINT IF EXISTS chk_image_type;
    
    -- 5. Add new check constraint allowing LOGO
    ALTER TABLE movie_image ADD CONSTRAINT chk_image_type CHECK (
        image_type IN ('POSTER', 'BACKDROP', 'STILL', 'PROMOTIONAL', 'LOGO')
    );
END $$;
