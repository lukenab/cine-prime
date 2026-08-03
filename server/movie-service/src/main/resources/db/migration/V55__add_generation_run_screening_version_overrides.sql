CREATE TABLE showtime_generation_run_screening_version_override (
    generation_run_id BIGINT NOT NULL,
    screening_version_id BIGINT NOT NULL,
    CONSTRAINT pk_generation_run_screening_version_override
        PRIMARY KEY (generation_run_id, screening_version_id),
    CONSTRAINT fk_generation_run_version_override_run
        FOREIGN KEY (generation_run_id)
        REFERENCES showtime_generation_run (generation_run_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_generation_run_version_override_version
        FOREIGN KEY (screening_version_id)
        REFERENCES movie_screening_version (screening_version_id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_generation_run_version_override_version
    ON showtime_generation_run_screening_version_override (screening_version_id);
