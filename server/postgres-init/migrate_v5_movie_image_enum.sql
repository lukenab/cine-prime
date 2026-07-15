-- =============================================================================
-- CinePrime — Migration v5: Normalize movie_image enum and update constraint
-- =============================================================================

\c movie_db;

-- 1. Normalize existing mixed-case data to uppercase
UPDATE movie_image 
SET image_type = UPPER(image_type);

-- 2. Map invalid/unknown types to 'STILL'
UPDATE movie_image 
SET image_type = 'STILL' 
WHERE image_type NOT IN ('POSTER', 'BACKDROP', 'STILL', 'PROMOTIONAL', 'LOGO');

-- 3. Drop old check constraint if it exists
ALTER TABLE movie_image DROP CONSTRAINT IF EXISTS chk_image_type;

-- 4. Add new check constraint allowing LOGO
ALTER TABLE movie_image ADD CONSTRAINT chk_image_type CHECK (
    image_type IN ('POSTER', 'BACKDROP', 'STILL', 'PROMOTIONAL', 'LOGO')
);
