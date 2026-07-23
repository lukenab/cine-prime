-- Same gap V32 fixed, re-run: any movie whose movie_format rows were added after
-- V32 executed (e.g. "Running Man Viet Nam 2026: Chua Te Thoi Gian", movie_id 47,
-- created via the catalog UI after V32 ran) never got a matching movie_screening_version
-- row, making it permanently ineligible for auto-showtime generation despite valid
-- formats, availability and room capability. MovieService now syncs this going forward
-- (syncScreeningVersions) - this is a one-off catch-up for rows created in the gap.
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
