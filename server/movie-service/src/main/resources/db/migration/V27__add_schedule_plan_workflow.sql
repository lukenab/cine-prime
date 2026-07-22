CREATE TABLE IF NOT EXISTS schedule_plan (
    schedule_plan_id BIGSERIAL PRIMARY KEY,
    generation_run_id BIGINT NOT NULL UNIQUE
        REFERENCES showtime_generation_run(generation_run_id) ON DELETE RESTRICT,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT_GENERATED',
    submitted_at TIMESTAMP,
    submitted_by VARCHAR(100),
    published_at TIMESTAMP,
    published_by VARCHAR(100),
    review_note TEXT,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_schedule_plan_status CHECK (
        status IN ('DRAFT_GENERATED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'PUBLISHED')
    )
);

CREATE TABLE IF NOT EXISTS schedule_plan_slot (
    schedule_plan_slot_id BIGSERIAL PRIMARY KEY,
    schedule_plan_id BIGINT NOT NULL
        REFERENCES schedule_plan(schedule_plan_id) ON DELETE CASCADE,
    movie_id BIGINT NOT NULL REFERENCES movie(movie_id) ON DELETE RESTRICT,
    cinema_room_id BIGINT NOT NULL REFERENCES cinema_room(cinema_room_id) ON DELETE RESTRICT,
    screening_version_id BIGINT NOT NULL
        REFERENCES movie_screening_version(screening_version_id) ON DELETE RESTRICT,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    business_date DATE NOT NULL,
    base_price NUMERIC(12,2),
    total_seats INTEGER,
    generation_reason VARCHAR(100),
    published_showtime_id BIGINT REFERENCES show_time(showtime_id) ON DELETE RESTRICT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_schedule_plan_slot_window CHECK (end_at > start_at),
    CONSTRAINT uq_schedule_plan_room_start UNIQUE (schedule_plan_id, cinema_room_id, start_at)
);

CREATE INDEX IF NOT EXISTS idx_schedule_plan_status ON schedule_plan(status);
CREATE INDEX IF NOT EXISTS idx_schedule_plan_slot_plan_time
    ON schedule_plan_slot(schedule_plan_id, business_date, start_at);

