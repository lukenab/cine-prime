-- V25 backfilled a schedulable original-language movie_screening_version for
-- every movie/format pair that existed at the time it ran, but any movie whose
-- movie_format rows were added afterward (e.g. PAW Patrol: The Dino Movie,
-- movie_id 46) never got a matching screening version - making it permanently
-- ineligible for auto-showtime generation despite having valid formats,
-- availability and room capability. Same logic as V25's second insert block,
-- re-run to catch what's been added since.
INSERT INTO movie_screening_version (
    movie_id, format_id, audio_language_code, subtitle_language_code, status
)
SELECT
    mf.movie_id,
    mf.format_id,
    COALESCE(NULLIF(m.original_language, ''), 'und'),
    NULL,
    'ACTIVE'
FROM movie_format mf
JOIN movie m ON m.movie_id = mf.movie_id
WHERE NOT EXISTS (
    SELECT 1
    FROM movie_screening_version existing
    WHERE existing.movie_id = mf.movie_id
      AND existing.format_id = mf.format_id
      AND existing.audio_language_code = COALESCE(NULLIF(m.original_language, ''), 'und')
      AND existing.subtitle_language_code IS NULL
);
