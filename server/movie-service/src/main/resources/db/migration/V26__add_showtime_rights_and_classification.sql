CREATE TABLE IF NOT EXISTS theatrical_license (
    license_id BIGSERIAL PRIMARY KEY,
    license_code VARCHAR(100) NOT NULL UNIQUE,
    movie_id BIGINT NOT NULL REFERENCES movie(movie_id) ON DELETE RESTRICT,
    cluster_id BIGINT REFERENCES cinema_cluster(cluster_id) ON DELETE RESTRICT,
    distributor_name VARCHAR(200) NOT NULL,
    territory_code VARCHAR(2) NOT NULL DEFAULT 'VN',
    valid_from DATE NOT NULL,
    valid_until DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_theatrical_license_window CHECK (valid_until >= valid_from),
    CONSTRAINT chk_theatrical_license_status
        CHECK (status IN ('DRAFT', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'REVOKED'))
);

CREATE TABLE IF NOT EXISTS theatrical_license_screening_version (
    license_id BIGINT NOT NULL REFERENCES theatrical_license(license_id) ON DELETE CASCADE,
    screening_version_id BIGINT NOT NULL
        REFERENCES movie_screening_version(screening_version_id) ON DELETE RESTRICT,
    PRIMARY KEY (license_id, screening_version_id)
);

CREATE TABLE IF NOT EXISTS movie_classification_approval (
    classification_approval_id BIGSERIAL PRIMARY KEY,
    movie_id BIGINT NOT NULL REFERENCES movie(movie_id) ON DELETE RESTRICT,
    age_rating_id INTEGER NOT NULL REFERENCES age_rating(rating_id) ON DELETE RESTRICT,
    territory_code VARCHAR(2) NOT NULL DEFAULT 'VN',
    approval_reference VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'APPROVED',
    valid_from DATE,
    valid_until DATE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_movie_classification_reference UNIQUE (territory_code, approval_reference),
    CONSTRAINT chk_movie_classification_window
        CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from),
    CONSTRAINT chk_movie_classification_status
        CHECK (status IN ('PENDING', 'APPROVED', 'SUSPENDED', 'REVOKED'))
);

-- Compatibility backfill: existing approved availability windows become
-- explicit migrated licenses. They remain auditable and can be replaced later.
INSERT INTO theatrical_license (
    license_code, movie_id, cluster_id, distributor_name,
    territory_code, valid_from, valid_until, status
)
SELECT
    'MIGRATED-AVAIL-' || availability_id,
    movie_id,
    cluster_id,
    'MIGRATED_AVAILABILITY',
    'VN',
    showing_start_date,
    COALESCE(showing_end_date, DATE '2999-12-31'),
    CASE WHEN status = 'SUSPENDED' THEN 'SUSPENDED' ELSE 'ACTIVE' END
FROM movie_availability availability
WHERE NOT EXISTS (
    SELECT 1 FROM theatrical_license license
    WHERE license.license_code = 'MIGRATED-AVAIL-' || availability.availability_id
);

INSERT INTO theatrical_license_screening_version (license_id, screening_version_id)
SELECT license.license_id, version.screening_version_id
FROM theatrical_license license
JOIN movie_screening_version version ON version.movie_id = license.movie_id
WHERE version.status = 'ACTIVE'
ON CONFLICT DO NOTHING;

INSERT INTO movie_classification_approval (
    movie_id, age_rating_id, territory_code, approval_reference, status
)
SELECT movie_id, age_rating_id, 'VN', 'MIGRATED-MOVIE-' || movie_id, 'APPROVED'
FROM movie
WHERE age_rating_id IS NOT NULL
ON CONFLICT (territory_code, approval_reference) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_license_eligibility
    ON theatrical_license(movie_id, cluster_id, territory_code, status, valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_classification_eligibility
    ON movie_classification_approval(movie_id, territory_code, status);

