-- V42 introduced audio_format_id as a separate screening-version attribute,
-- but deliberately left legacy rows unresolved. Dolby 5.1 is the conservative
-- compatibility baseline: it does not incorrectly claim a premium Atmos/7.1
-- mix and can be reproduced by every higher-capability room in the current
-- compatibility matrix.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM movie_screening_version
        WHERE audio_format_id IS NULL
    ) AND NOT EXISTS (
        SELECT 1
        FROM audio_format
        WHERE format_code = 'DOLBY_5_1'
    ) THEN
        RAISE EXCEPTION
            'Cannot backfill legacy screening versions: DOLBY_5_1 reference data is missing';
    END IF;
END
$$;

-- A manually corrected Dolby 5.1 version may already exist for the same
-- business key. Preserve that canonical row and redirect operational
-- references before removing the unresolved duplicate.
WITH duplicate_versions AS (
    SELECT
        legacy.screening_version_id AS legacy_id,
        canonical.screening_version_id AS canonical_id
    FROM movie_screening_version legacy
    JOIN audio_format default_audio
      ON default_audio.format_code = 'DOLBY_5_1'
    JOIN movie_screening_version canonical
      ON canonical.movie_id = legacy.movie_id
     AND canonical.format_id = legacy.format_id
     AND canonical.audio_format_id = default_audio.audio_format_id
     AND canonical.audio_language_code = legacy.audio_language_code
     AND COALESCE(canonical.subtitle_language_code, '')
         = COALESCE(legacy.subtitle_language_code, '')
    WHERE legacy.audio_format_id IS NULL
)
UPDATE show_time showtime
SET screening_version_id = duplicate_versions.canonical_id
FROM duplicate_versions
WHERE showtime.screening_version_id = duplicate_versions.legacy_id;

WITH duplicate_versions AS (
    SELECT
        legacy.screening_version_id AS legacy_id,
        canonical.screening_version_id AS canonical_id
    FROM movie_screening_version legacy
    JOIN audio_format default_audio
      ON default_audio.format_code = 'DOLBY_5_1'
    JOIN movie_screening_version canonical
      ON canonical.movie_id = legacy.movie_id
     AND canonical.format_id = legacy.format_id
     AND canonical.audio_format_id = default_audio.audio_format_id
     AND canonical.audio_language_code = legacy.audio_language_code
     AND COALESCE(canonical.subtitle_language_code, '')
         = COALESCE(legacy.subtitle_language_code, '')
    WHERE legacy.audio_format_id IS NULL
)
UPDATE schedule_plan_slot slot
SET screening_version_id = duplicate_versions.canonical_id
FROM duplicate_versions
WHERE slot.screening_version_id = duplicate_versions.legacy_id;

DELETE FROM movie_screening_version legacy
USING audio_format default_audio, movie_screening_version canonical
WHERE legacy.audio_format_id IS NULL
  AND default_audio.format_code = 'DOLBY_5_1'
  AND canonical.movie_id = legacy.movie_id
  AND canonical.format_id = legacy.format_id
  AND canonical.audio_format_id = default_audio.audio_format_id
  AND canonical.audio_language_code = legacy.audio_language_code
  AND COALESCE(canonical.subtitle_language_code, '')
      = COALESCE(legacy.subtitle_language_code, '');

UPDATE movie_screening_version version
SET audio_format_id = default_audio.audio_format_id,
    updated_at = CURRENT_TIMESTAMP
FROM audio_format default_audio
WHERE version.audio_format_id IS NULL
  AND default_audio.format_code = 'DOLBY_5_1';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM movie_screening_version
        WHERE audio_format_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'Legacy screening-version audio backfill left unresolved rows';
    END IF;
END
$$;

ALTER TABLE movie_screening_version
    ALTER COLUMN audio_format_id SET NOT NULL;

COMMENT ON COLUMN movie_screening_version.audio_format_id IS
    'Required content audio mix; legacy unresolved rows were conservatively backfilled to Dolby 5.1 by V49.';
