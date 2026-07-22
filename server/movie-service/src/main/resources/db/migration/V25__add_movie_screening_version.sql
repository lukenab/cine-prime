CREATE TABLE IF NOT EXISTS movie_screening_version (
    screening_version_id BIGSERIAL PRIMARY KEY,
    movie_id BIGINT NOT NULL REFERENCES movie(movie_id) ON DELETE RESTRICT,
    format_id INTEGER NOT NULL REFERENCES screening_format(format_id) ON DELETE RESTRICT,
    audio_language_code VARCHAR(10) NOT NULL,
    subtitle_language_code VARCHAR(10),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    effective_from DATE,
    effective_to DATE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_screening_version_status
        CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUPERSEDED')),
    CONSTRAINT chk_screening_version_effective_window
        CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_movie_screening_version_business_key
    ON movie_screening_version (
        movie_id,
        format_id,
        audio_language_code,
        COALESCE(subtitle_language_code, '')
    );

-- Preserve the concrete combinations already used by legacy showtimes.
INSERT INTO movie_screening_version (
    movie_id, format_id, audio_language_code, subtitle_language_code, status
)
SELECT DISTINCT
    st.movie_id,
    st.format_id,
    COALESCE(NULLIF(st.language_code, ''), NULLIF(m.original_language, ''), 'und'),
    NULLIF(st.subtitle_code, ''),
    'ACTIVE'
FROM show_time st
JOIN movie m ON m.movie_id = st.movie_id
WHERE st.format_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM movie_screening_version existing
      WHERE existing.movie_id = st.movie_id
        AND existing.format_id = st.format_id
        AND existing.audio_language_code = COALESCE(NULLIF(st.language_code, ''), NULLIF(m.original_language, ''), 'und')
        AND COALESCE(existing.subtitle_language_code, '') = COALESCE(NULLIF(st.subtitle_code, ''), '')
  );

-- Give every configured movie/format pair a schedulable original-language version.
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

ALTER TABLE show_time
    ADD COLUMN IF NOT EXISTS screening_version_id BIGINT;

ALTER TABLE show_time DROP CONSTRAINT IF EXISTS fk_showtime_screening_version;
ALTER TABLE show_time
    ADD CONSTRAINT fk_showtime_screening_version
    FOREIGN KEY (screening_version_id)
    REFERENCES movie_screening_version(screening_version_id)
    ON DELETE RESTRICT;

UPDATE show_time st
SET screening_version_id = version.screening_version_id
FROM movie_screening_version version
WHERE st.screening_version_id IS NULL
  AND version.movie_id = st.movie_id
  AND version.format_id = st.format_id
  AND version.audio_language_code = COALESCE(NULLIF(st.language_code, ''), version.audio_language_code)
  AND COALESCE(version.subtitle_language_code, '') = COALESCE(NULLIF(st.subtitle_code, ''), '');

CREATE INDEX IF NOT EXISTS idx_screening_version_movie_status
    ON movie_screening_version(movie_id, status);
CREATE INDEX IF NOT EXISTS idx_showtime_screening_version
    ON show_time(screening_version_id);

