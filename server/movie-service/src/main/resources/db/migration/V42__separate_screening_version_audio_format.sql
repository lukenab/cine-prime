-- Dolby Atmos is an audio capability, not a presentation/screening format.
-- Legacy versions may keep audio_format_id NULL; new commands require an
-- explicit active audio format. Legacy ATMOS-as-format rows are deactivated
-- for manual review instead of being guessed as 2D/3D/IMAX content.

ALTER TABLE movie_screening_version
    ADD COLUMN IF NOT EXISTS audio_format_id SMALLINT;

ALTER TABLE movie_screening_version
    DROP CONSTRAINT IF EXISTS fk_movie_screening_version_audio_format;
ALTER TABLE movie_screening_version
    ADD CONSTRAINT fk_movie_screening_version_audio_format
        FOREIGN KEY (audio_format_id)
        REFERENCES audio_format(audio_format_id)
        ON DELETE RESTRICT;

UPDATE movie_screening_version version
SET audio_format_id = audio.audio_format_id,
    status = 'INACTIVE',
    updated_at = CURRENT_TIMESTAMP
FROM screening_format format, audio_format audio
WHERE version.format_id = format.format_id
  AND format.format_code = 'ATMOS'
  AND audio.format_code = 'DOLBY_ATMOS'
  AND version.audio_format_id IS NULL;

-- Preserve historical foreign-key targets but hide ATMOS from new
-- presentation-format selections.
UPDATE screening_format
SET status = 'RETIRED',
    updated_at = CURRENT_TIMESTAMP
WHERE format_code = 'ATMOS';

DROP INDEX IF EXISTS uq_movie_screening_version_business_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_movie_screening_version_business_key
    ON movie_screening_version (
        movie_id,
        format_id,
        COALESCE(audio_format_id, 0),
        audio_language_code,
        COALESCE(subtitle_language_code, '')
    );

CREATE INDEX IF NOT EXISTS idx_screening_version_audio_format
    ON movie_screening_version(audio_format_id);
