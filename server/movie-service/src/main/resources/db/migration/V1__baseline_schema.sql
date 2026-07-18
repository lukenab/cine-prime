-- =============================================================================
-- Flyway V1: Baseline schema for movie_db.
--
-- This consolidates everything previously built by hand-run SQL files under
-- docs/database/movie-service/ (V3 through V34) plus the original v1->v2
-- redesign. Those files are kept in place for historical/audit reference but
-- are superseded as of this migration — see
-- docs/database/movie-service/README.md for why this was consolidated into a
-- single baseline instead of replayed as 30+ individual Flyway versions
-- (short version: postgres-init/movie_db.sql, the file this was extracted
-- from, was itself a hand-maintained CURRENT-STATE snapshot rather than a
-- preserved stack of historical diffs, so replaying it as incremental steps
-- would not have been any more historically faithful — just riskier to get
-- subtly wrong).
--
-- Pure DDL only. Reference/seed data lives in the repeatable migration
-- R__seed_reference_data.sql so it can be updated independently of schema
-- changes (idempotent upserts, re-run automatically whenever it changes).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- =============================================================================
-- FUNCTION: auto-update updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 1. GENRE
-- =============================================================================
CREATE TABLE IF NOT EXISTS genre (
    genre_id    BIGSERIAL    PRIMARY KEY,
    genre_name  VARCHAR(100) NOT NULL,
    genre_code  VARCHAR(50)  NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_genre_name UNIQUE (genre_name),
    CONSTRAINT uq_genre_code UNIQUE (genre_code)
);

COMMENT ON TABLE  genre IS 'Thể loại phim — admin quản lý, frontend dùng dropdown';
COMMENT ON COLUMN genre.genre_code IS 'Slug dùng cho query param: /movies?genre=action';

ALTER TABLE genre
    ADD COLUMN IF NOT EXISTS tmdb_genre_id INTEGER UNIQUE,
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

-- =============================================================================
-- 2. AGE RATING (Thông tư 05/2023/TT-BVHTTDL)
-- =============================================================================
CREATE TABLE IF NOT EXISTS age_rating (
    rating_id    SMALLSERIAL  PRIMARY KEY,
    rating_code  VARCHAR(5)   NOT NULL UNIQUE,
    min_age      SMALLINT     NOT NULL DEFAULT 0,
    description  VARCHAR(255) NOT NULL
);

COMMENT ON TABLE  age_rating IS 'Phân loại độ tuổi theo tiêu chuẩn Cục ĐAVT Việt Nam';
COMMENT ON COLUMN age_rating.rating_code IS 'P=Mọi lứa tuổi, K=Dưới 13 có phụ huynh, T13/T16/T18=Từ độ tuổi X, C=Cấm chiếu';

-- =============================================================================
-- 3. SCREENING FORMAT
-- =============================================================================
CREATE TABLE IF NOT EXISTS screening_format (
    format_id    SMALLSERIAL   PRIMARY KEY,
    format_code  VARCHAR(20)   NOT NULL UNIQUE,
    format_name  VARCHAR(100)  NOT NULL,
    description  VARCHAR(255),
    surcharge    DECIMAL(10,2) NOT NULL DEFAULT 0
);

COMMENT ON TABLE  screening_format IS '2D/3D/IMAX/4DX/ScreenX — quản lý qua dropdown, không nhập tay';
COMMENT ON COLUMN screening_format.surcharge IS 'Phụ phí thêm vào giá vé cơ bản (VD: IMAX + 50.000đ)';

-- =============================================================================
-- 4. PRODUCTION COMPANY
-- =============================================================================
CREATE TABLE IF NOT EXISTS production_company (
    company_id   BIGSERIAL    PRIMARY KEY,
    name         VARCHAR(255) NOT NULL,
    country      VARCHAR(100),
    logo_url     VARCHAR(500),
    website_url  VARCHAR(500),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_company_name UNIQUE (name)
);

COMMENT ON TABLE production_company IS 'Hãng phim sản xuất — quản lý qua dropdown, không cho nhập tay tự do';

-- =============================================================================
-- 5. PERSON
-- =============================================================================
CREATE TABLE IF NOT EXISTS person (
    person_id    BIGSERIAL    PRIMARY KEY,
    full_name    VARCHAR(255) NOT NULL,
    birth_date   DATE,
    nationality  VARCHAR(100),
    photo_url    VARCHAR(500),
    biography    TEXT,
    tmdb_id      INTEGER      UNIQUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_person_updated_at
    BEFORE UPDATE ON person
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE  person IS 'Diễn viên, đạo diễn, biên kịch — có thể fetch từ TMDB API';
COMMENT ON COLUMN person.tmdb_id IS 'TMDB person ID — dùng để dedup khi import từ API';

-- =============================================================================
-- 6. MOVIE
-- =============================================================================
CREATE TABLE IF NOT EXISTS movie (
    movie_id          BIGSERIAL     PRIMARY KEY,

    tmdb_id           INTEGER       UNIQUE,
    imdb_id           VARCHAR(20)   UNIQUE,

    original_title    VARCHAR(500)  NOT NULL,
    original_language CHAR(2)       NOT NULL DEFAULT 'en',

    duration_minutes  SMALLINT      NOT NULL
                      CONSTRAINT chk_duration CHECK (duration_minutes BETWEEN 1 AND 600),
    release_date      DATE,
    age_rating_id     SMALLINT      REFERENCES age_rating(rating_id),
    company_id        BIGINT        REFERENCES production_company(company_id),
    country           VARCHAR(100),

    poster_url        VARCHAR(500),
    thumbnail_url     VARCHAR(500),
    trailer_url       VARCHAR(500),

    synopsis          TEXT,

    -- Content-review lifecycle only. See docs/api-specs/movie-service/MOVIE_LIFECYCLE_CONTRACT.md
    -- for the full state machine; exhibition/availability is tracked separately
    -- in movie_availability (per cluster), not here.
    status            VARCHAR(20)   NOT NULL DEFAULT 'DRAFT'
                      CONSTRAINT chk_movie_status
                          CHECK (status IN ('DRAFT','PENDING_REVIEW','APPROVED',
                                            'CHANGES_REQUESTED','ARCHIVED')),
    rejection_note    TEXT,
    version           BIGINT        NOT NULL DEFAULT 0,

    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_by        VARCHAR(100),
    updated_by        VARCHAR(100)
);

CREATE TRIGGER trg_movie_updated_at
    BEFORE UPDATE ON movie
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_movie_status        ON movie(status);
CREATE INDEX IF NOT EXISTS idx_movie_release_date  ON movie(release_date);
CREATE INDEX IF NOT EXISTS idx_movie_tmdb          ON movie(tmdb_id) WHERE tmdb_id IS NOT NULL;

COMMENT ON TABLE  movie IS 'Bảng phim chính — status chỉ còn kiểm soát content review workflow, không mang trạng thái vận hành/phát hành';
COMMENT ON COLUMN movie.original_title    IS 'Tên phim gốc (từ nhà sản xuất hoặc TMDB). Bản dịch VN/EN lưu ở movie_translation';
COMMENT ON COLUMN movie.duration_minutes  IS 'CHECK 1–600 phút';
COMMENT ON COLUMN movie.status            IS 'Enum: DRAFT | PENDING_REVIEW | APPROVED | CHANGES_REQUESTED | ARCHIVED — content review only, xem movie_availability cho vận hành';
COMMENT ON COLUMN movie.rejection_note    IS 'Bắt buộc điền khi ADMIN set CHANGES_REQUESTED. EMPLOYEE đọc lý do để sửa lại';
COMMENT ON COLUMN movie.tmdb_id           IS 'Dùng để dedup khi import phim từ TMDB API. UNIQUE constraint ngăn trùng lặp';

CREATE TABLE IF NOT EXISTS movie_status_history (
    history_id   BIGSERIAL     PRIMARY KEY,
    movie_id     BIGINT        NOT NULL REFERENCES movie(movie_id) ON DELETE CASCADE,
    from_status  VARCHAR(20)   NULL,
    to_status    VARCHAR(20)   NOT NULL,
    actor        VARCHAR(100)  NOT NULL,
    reason       VARCHAR(500)  NULL,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_movie_status_history_movie ON movie_status_history(movie_id, created_at);

-- =============================================================================
-- 7. MOVIE TRANSLATION
-- =============================================================================
CREATE TABLE IF NOT EXISTS movie_translation (
    movie_id       BIGINT       NOT NULL REFERENCES movie(movie_id) ON DELETE CASCADE,
    language_code  CHAR(2)      NOT NULL,
    title          VARCHAR(500) NOT NULL,
    synopsis       TEXT,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    PRIMARY KEY (movie_id, language_code)
);

COMMENT ON TABLE  movie_translation IS '1 phim N ngôn ngữ. Thay thế movie_name_vn + movie_name_english';
COMMENT ON COLUMN movie_translation.language_code IS 'ISO 639-1: vi=Tiếng Việt, en=English, ko=한국어, ja=日本語';

-- =============================================================================
-- 8. MOVIE GENRE (junction)
-- =============================================================================
CREATE TABLE IF NOT EXISTS movie_genre (
    movie_id   BIGINT  NOT NULL REFERENCES movie(movie_id)  ON DELETE CASCADE,
    genre_id   BIGINT  NOT NULL REFERENCES genre(genre_id)  ON DELETE RESTRICT,
    PRIMARY KEY (movie_id, genre_id)
);

COMMENT ON TABLE movie_genre IS 'Junction: movie ↔ genre. Đổi tên từ movie_movie_types';

-- =============================================================================
-- 9. MOVIE FORMAT (junction)
-- =============================================================================
CREATE TABLE IF NOT EXISTS movie_format (
    movie_id   BIGINT   NOT NULL REFERENCES movie(movie_id)            ON DELETE CASCADE,
    format_id  SMALLINT NOT NULL REFERENCES screening_format(format_id) ON DELETE RESTRICT,
    PRIMARY KEY (movie_id, format_id)
);

COMMENT ON TABLE movie_format IS 'Phim hỗ trợ những định dạng nào (2D/3D/IMAX…). Suất chiếu phải chọn format trong danh sách này';

-- =============================================================================
-- 10. MOVIE CAST
-- =============================================================================
CREATE TABLE IF NOT EXISTS movie_cast (
    cast_id         BIGSERIAL    PRIMARY KEY,
    movie_id        BIGINT       NOT NULL REFERENCES movie(movie_id)   ON DELETE CASCADE,
    person_id       BIGINT       NOT NULL REFERENCES person(person_id) ON DELETE RESTRICT,
    role_type       VARCHAR(20)  NOT NULL
                    CONSTRAINT chk_role_type
                        CHECK (role_type IN ('ACTOR','DIRECTOR','WRITER','PRODUCER','COMPOSER')),
    character_name  VARCHAR(255),
    billing_order   SMALLINT,
    CONSTRAINT uq_movie_person_role UNIQUE (movie_id, person_id, role_type)
);

CREATE INDEX IF NOT EXISTS idx_movie_cast_movie  ON movie_cast(movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_cast_person ON movie_cast(person_id);

COMMENT ON TABLE  movie_cast IS 'Diễn viên / đạo diễn / biên kịch của phim — thay thế actor VARCHAR, director VARCHAR';
COMMENT ON COLUMN movie_cast.billing_order IS '1 = top billing (diễn viên chính đứng đầu). NULL = thứ tự không quan trọng';

-- =============================================================================
-- 11. CINEMA ROOM
-- =============================================================================
CREATE TABLE IF NOT EXISTS cinema_room (
    cinema_room_id    BIGSERIAL    PRIMARY KEY,
    cinema_room_name  VARCHAR(100) NOT NULL,

    room_type         VARCHAR(20)  NOT NULL DEFAULT 'STANDARD'
                      CONSTRAINT chk_room_type
                          CHECK (room_type IN ('STANDARD','LARGE','IMAX','4DX','SCREENX')),

    presentation_system VARCHAR(30) NOT NULL DEFAULT 'STANDARD'
                      CONSTRAINT chk_room_presentation_system
                          CHECK (presentation_system IN ('STANDARD','IMAX','DOLBY_CINEMA','SCREENX')),

    total_seat_capacity INTEGER    NOT NULL DEFAULT 0,

    status            VARCHAR(30)  NOT NULL DEFAULT 'ACTIVE'
                      CONSTRAINT chk_room_status
                          CHECK (status IN (
                              'DRAFT', 'PENDING_APPROVAL', 'APPROVED',
                              'ACTIVE', 'MAINTENANCE', 'TEMPORARILY_UNAVAILABLE',
                              'SUSPENDED', 'CLOSED', 'RETIRED'
                          )),
    maintenance_note  TEXT,

    number_of_rows        INTEGER NOT NULL DEFAULT 0,
    seats_per_row         INTEGER NOT NULL DEFAULT 0,
    standard_row_count    INTEGER NOT NULL DEFAULT 0,
    vip_row_count         INTEGER NOT NULL DEFAULT 0,
    couple_row_count      INTEGER NOT NULL DEFAULT 0,

    room_code             VARCHAR(20),
    length_m              DECIMAL(6,2),
    width_m               DECIMAL(6,2),
    clear_height_m        DECIMAL(6,2),
    screen_width_m        DECIMAL(6,2),
    screen_height_m       DECIMAL(6,2),
    supports_2d           BOOLEAN NOT NULL DEFAULT TRUE,
    supports_3d           BOOLEAN NOT NULL DEFAULT FALSE,

    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by        VARCHAR(100),
    updated_by        VARCHAR(100),

    CONSTRAINT chk_room_row_allocation_non_negative
        CHECK (standard_row_count >= 0 AND vip_row_count >= 0 AND couple_row_count >= 0)
);

CREATE TRIGGER trg_cinema_room_updated_at
    BEFORE UPDATE ON cinema_room
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON COLUMN cinema_room.status IS 'DRAFT..RETIRED — xem RoomLayoutService cho maker-checker workflow';
COMMENT ON COLUMN cinema_room.maintenance_note IS 'Bắt buộc điền khi chuyển status khỏi ACTIVE. Ghi lý do cụ thể';
COMMENT ON COLUMN cinema_room.room_code IS 'Mã phòng ngắn (VD "R01") do wizard tạo phòng chi tiết dùng — null với phòng tạo qua flow cũ';

-- =============================================================================
-- 12. CINEMA ROOM MAINTENANCE
-- =============================================================================
CREATE TABLE IF NOT EXISTS cinema_room_maintenance (
    maintenance_id  BIGSERIAL    PRIMARY KEY,
    cinema_room_id  BIGINT       NOT NULL REFERENCES cinema_room(cinema_room_id),
    reason          TEXT         NOT NULL,
    severity        VARCHAR(20)  NOT NULL DEFAULT 'MEDIUM'
                    CONSTRAINT chk_severity CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    started_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ,
    resolved        BOOLEAN      NOT NULL DEFAULT FALSE,
    resolution_note TEXT,
    created_by      VARCHAR(100) NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_room     ON cinema_room_maintenance(cinema_room_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_resolved ON cinema_room_maintenance(resolved) WHERE resolved = FALSE;

COMMENT ON TABLE cinema_room_maintenance IS 'Lịch sử bảo trì/sự cố phòng chiếu. Khi tạo record mới → service tự cancel showtimes tương lai của phòng';

-- =============================================================================
-- 13. SEAT
-- =============================================================================
CREATE TABLE IF NOT EXISTS seat (
    seat_id         BIGSERIAL     PRIMARY KEY,
    cinema_room_id  BIGINT        NOT NULL REFERENCES cinema_room(cinema_room_id) ON DELETE CASCADE,

    seat_code       VARCHAR(10)   NOT NULL,
    row_label       VARCHAR(5)    NOT NULL,
    col_number      SMALLINT      NOT NULL,

    seat_type       VARCHAR(20)   NOT NULL DEFAULT 'STANDARD'
                    CONSTRAINT chk_seat_type
                        CHECK (seat_type IN ('STANDARD','VIP','COUPLE','ACCESSIBLE')),

    status          VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE'
                    CONSTRAINT chk_seat_status
                        CHECK (status IN ('ACTIVE','INACTIVE','MAINTENANCE')),

    base_price      DECIMAL(10,2) NOT NULL DEFAULT 0,
    seat_group_id   VARCHAR(36),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_seat_code_room    UNIQUE (cinema_room_id, seat_code),
    CONSTRAINT uq_seat_position     UNIQUE (cinema_room_id, row_label, col_number)
);

CREATE TRIGGER trg_seat_updated_at
    BEFORE UPDATE ON seat
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_seat_cinema_room ON seat(cinema_room_id);
CREATE INDEX IF NOT EXISTS idx_seat_type        ON seat(cinema_room_id, seat_type);
CREATE INDEX IF NOT EXISTS idx_seat_group_id    ON seat(seat_group_id) WHERE seat_group_id IS NOT NULL;

COMMENT ON TABLE  seat IS 'Ghế vật lý trong phòng — status là trạng thái master, độc lập với showtime';
COMMENT ON COLUMN seat.row_label   IS 'Ký hiệu hàng (A, B, AA…) dùng để render sơ đồ ghế ngồi trên frontend';
COMMENT ON COLUMN seat.col_number  IS 'Số thứ tự cột dùng để render sơ đồ ghế ngồi trên frontend';
COMMENT ON COLUMN seat.status      IS 'ACTIVE=bình thường | INACTIVE=ẩn | MAINTENANCE=hỏng/đang sửa';

-- =============================================================================
-- 14. SHOW TIME
-- =============================================================================
CREATE TABLE IF NOT EXISTS show_time (
    showtime_id       BIGSERIAL     PRIMARY KEY,

    movie_id          BIGINT        NOT NULL
                      REFERENCES movie(movie_id) ON DELETE RESTRICT,

    cinema_room_id    BIGINT        NOT NULL
                      REFERENCES cinema_room(cinema_room_id) ON DELETE RESTRICT,

    format_id         SMALLINT      REFERENCES screening_format(format_id),

    language_code     CHAR(2)       NOT NULL DEFAULT 'vi',
    subtitle_code     CHAR(2),

    show_date         DATE          NOT NULL,
    start_time        TIME          NOT NULL,
    end_time          TIME          NOT NULL,

    base_price        DECIMAL(10,2) NOT NULL DEFAULT 0,

    status            VARCHAR(20)   NOT NULL DEFAULT 'SCHEDULED'
                      CONSTRAINT chk_showtime_status
                          CHECK (status IN ('SCHEDULED','ON_SALE','CANCELLED','COMPLETED','SUSPENDED')),

    cancellation_reason TEXT,
    cancelled_at        TIMESTAMPTZ,
    cancelled_by        VARCHAR(100),

    total_seats       INTEGER       NOT NULL DEFAULT 0,
    sold_seats        INTEGER       NOT NULL DEFAULT 0,

    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_by        VARCHAR(100),
    updated_by        VARCHAR(100),

    CONSTRAINT chk_showtime_times CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_showtime_movie     ON show_time(movie_id);
CREATE INDEX IF NOT EXISTS idx_showtime_room      ON show_time(cinema_room_id);
CREATE INDEX IF NOT EXISTS idx_showtime_date      ON show_time(show_date);
CREATE INDEX IF NOT EXISTS idx_showtime_status    ON show_time(status);
CREATE INDEX IF NOT EXISTS idx_showtime_movie_date ON show_time(movie_id, show_date)
    WHERE status IN ('SCHEDULED','ON_SALE');

-- Overlap Prevention: chặn tạo 2 suất chiếu cùng phòng trùng giờ ở DB level.
-- NOTE: date::text/time::text casts are only STABLE (their exact output can
-- depend on the session's DateStyle), not IMMUTABLE, so building the range
-- boundaries that way — as the original hand-run version of this constraint
-- did — is rejected by Postgres for a GIST exclusion index. `date + time`
-- (native operator, not a text round-trip) is immutable and equivalent.
-- This was caught by FlywayMigrationIntegrationTest's fresh-database run:
-- the original text-cast form had in fact never successfully been applied to
-- the shared dev database either (`no_overlapping_showtimes` didn't exist —
-- confirmed via `pg_get_constraintdef` returning no rows), so this isn't a
-- behavior change, just fixing DDL that silently never took effect.
ALTER TABLE show_time ADD CONSTRAINT no_overlapping_showtimes
    EXCLUDE USING GIST (
        cinema_room_id WITH =,
        (daterange(show_date, show_date, '[]')) WITH &&,
        (tsrange(show_date + start_time, show_date + end_time)) WITH &&
    )
    WHERE (status NOT IN ('CANCELLED'));

CREATE TRIGGER trg_showtime_updated_at
    BEFORE UPDATE ON show_time
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE  show_time IS 'Suất chiếu. EXCLUDE GIST ngăn trùng giờ cùng phòng ở DB level';
COMMENT ON COLUMN show_time.language_code    IS 'Ngôn ngữ âm thanh của suất chiếu: vi=lồng tiếng VN, en=tiếng Anh';
COMMENT ON COLUMN show_time.subtitle_code    IS 'Ngôn ngữ phụ đề. NULL = không có phụ đề (phim lồng tiếng)';
COMMENT ON COLUMN show_time.format_id        IS 'Phải là format mà phim đó hỗ trợ (validate ở service layer qua movie_format)';
COMMENT ON COLUMN show_time.cancellation_reason IS 'Bắt buộc ghi khi set status = CANCELLED';
COMMENT ON COLUMN show_time.sold_seats       IS 'Snapshot counter. Phải sync với COUNT(showtime_seat WHERE status=SOLD)';

-- =============================================================================
-- 15. SHOWTIME SEAT
-- =============================================================================
CREATE TABLE IF NOT EXISTS showtime_seat (
    showtime_seat_id    BIGSERIAL      PRIMARY KEY,
    showtime_id         BIGINT         NOT NULL REFERENCES show_time(showtime_id) ON DELETE CASCADE,
    seat_id             BIGINT         NOT NULL REFERENCES seat(seat_id),

    seat_code           VARCHAR(10)    NOT NULL,
    seat_type           VARCHAR(20)    NOT NULL DEFAULT 'STANDARD',
    price               DECIMAL(10,2)  NOT NULL,

    status              VARCHAR(20)    NOT NULL DEFAULT 'AVAILABLE'
                        CONSTRAINT chk_showtime_seat_status
                            CHECK (status IN ('AVAILABLE','RESERVED','SOLD','BLOCKED','CANCELLED')),

    reserved_at         TIMESTAMPTZ,
    reserved_expires_at TIMESTAMPTZ,

    booking_id          VARCHAR(36),

    CONSTRAINT uq_showtime_seat UNIQUE (showtime_id, seat_id)
);

CREATE INDEX IF NOT EXISTS idx_ss_showtime ON showtime_seat(showtime_id);
CREATE INDEX IF NOT EXISTS idx_ss_status   ON showtime_seat(showtime_id, status);
CREATE INDEX IF NOT EXISTS idx_ss_booking  ON showtime_seat(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ss_expires  ON showtime_seat(reserved_expires_at)
    WHERE status = 'RESERVED';

COMMENT ON TABLE  showtime_seat IS 'Trạng thái từng ghế trong từng suất chiếu. Snapshot price + seat_code để đảm bảo tính toàn vẹn dữ liệu';
COMMENT ON COLUMN showtime_seat.booking_id          IS 'UUID từ booking-service. Không FK vì cross-database. Điền khi SOLD';
COMMENT ON COLUMN showtime_seat.reserved_expires_at IS 'Job scheduler quét mỗi 30s để giải phóng ghế RESERVED quá hạn';
COMMENT ON COLUMN showtime_seat.status IS 'AVAILABLE | RESERVED | SOLD | BLOCKED | CANCELLED';

-- =============================================================================
-- 16. MOVIE ACTION LOG
-- =============================================================================
CREATE TABLE IF NOT EXISTS movie_action_log (
    id                 VARCHAR(36)   PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    movie_id           BIGINT        REFERENCES movie(movie_id) ON DELETE SET NULL,
    account_id         VARCHAR(100)  NOT NULL,
    action_type        VARCHAR(50)   NOT NULL,
    action_description TEXT,
    old_status         VARCHAR(20),
    new_status         VARCHAR(20),
    note               TEXT,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movie_log_movie   ON movie_action_log(movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_log_account ON movie_action_log(account_id);
CREATE INDEX IF NOT EXISTS idx_movie_log_time    ON movie_action_log(created_at DESC);

COMMENT ON TABLE movie_action_log IS 'Audit trail cho mọi thay đổi trên phim. Ghi lại old_status/new_status để trace vòng đời';

-- =============================================================================
-- 17. CINEMA CLUSTER
-- =============================================================================
CREATE TABLE IF NOT EXISTS cinema_cluster (
    cluster_id    BIGSERIAL     PRIMARY KEY,
    cluster_code  VARCHAR(20)   NOT NULL,
    cluster_name  VARCHAR(100)  NOT NULL,
    venue_type    VARCHAR(20)   NOT NULL DEFAULT 'MALL'
                  CONSTRAINT chk_cluster_venue_type
                      CHECK (venue_type IN ('MALL', 'STANDALONE', 'MIXED_USE')),
    opening_date  DATE,
    public_email  VARCHAR(150),
    country_code  CHAR(2)       NOT NULL DEFAULT 'VN',
    province      VARCHAR(100)  NOT NULL,
    ward          VARCHAR(100),
    postal_code   VARCHAR(20),
    building_name VARCHAR(150),
    floor_location VARCHAR(50),
    address       VARCHAR(255)  NOT NULL,
    phone_number  VARCHAR(20),
    status        VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE'
                  CONSTRAINT chk_cluster_status
                      CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'INACTIVE')),
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    latitude      DECIMAL(10, 7),
    longitude     DECIMAL(10, 7),
    timezone      VARCHAR(50)   NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    rejection_note TEXT,
    created_by    VARCHAR(100),
    updated_by    VARCHAR(100)
);

CREATE TRIGGER trg_cinema_cluster_updated_at
    BEFORE UPDATE ON cinema_cluster
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS uq_cluster_name_ci
    ON cinema_cluster (LOWER(cluster_name));

CREATE UNIQUE INDEX IF NOT EXISTS uq_cluster_code_ci
    ON cinema_cluster (LOWER(cluster_code));

ALTER TABLE cinema_room
    ADD COLUMN IF NOT EXISTS cluster_id BIGINT
        REFERENCES cinema_cluster(cluster_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cinema_room_cluster ON cinema_room(cluster_id);

ALTER TABLE cinema_room
    ADD CONSTRAINT uq_room_name_per_cluster
    UNIQUE (cluster_id, cinema_room_name);

CREATE TABLE IF NOT EXISTS cluster_audit_log (
    log_id       VARCHAR(36)   PRIMARY KEY,
    cluster_id   BIGINT        NOT NULL
                     REFERENCES cinema_cluster(cluster_id) ON DELETE CASCADE,
    action       VARCHAR(20)   NOT NULL,
    performed_by VARCHAR(255),
    old_status   VARCHAR(20),
    new_status   VARCHAR(20),
    note         TEXT,
    timestamp    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cluster_audit_log_cluster_id
    ON cluster_audit_log(cluster_id);

CREATE INDEX IF NOT EXISTS idx_cluster_audit_log_timestamp
    ON cluster_audit_log(timestamp DESC);

-- =============================================================================
-- 18. MOVIE AVAILABILITY (per-cluster exhibition lifecycle, MOV-LC-03)
-- =============================================================================
CREATE TABLE IF NOT EXISTS movie_availability (
    availability_id     BIGSERIAL     PRIMARY KEY,
    movie_id             BIGINT        NOT NULL REFERENCES movie(movie_id) ON DELETE CASCADE,
    cluster_id           BIGINT        NOT NULL REFERENCES cinema_cluster(cluster_id),
    status                VARCHAR(20)   NOT NULL DEFAULT 'PLANNED'
                          CONSTRAINT chk_availability_status
                              CHECK (status IN ('PLANNED', 'OPEN', 'SUSPENDED', 'CLOSED')),
    sales_start_at        TIMESTAMPTZ   NULL,
    showing_start_date    DATE          NOT NULL,
    showing_end_date      DATE          NULL,
    suspension_reason     VARCHAR(500)  NULL,
    version               BIGINT        NOT NULL DEFAULT 0,
    created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_by            VARCHAR(100)  NULL,
    updated_by            VARCHAR(100)  NULL,
    CONSTRAINT chk_availability_date_range
        CHECK (showing_end_date IS NULL OR showing_end_date >= showing_start_date),
    CONSTRAINT uq_availability_window UNIQUE (movie_id, cluster_id, showing_start_date)
);
CREATE INDEX IF NOT EXISTS idx_movie_availability_cluster_status
    ON movie_availability(cluster_id, status, showing_start_date);
CREATE INDEX IF NOT EXISTS idx_movie_availability_movie_cluster
    ON movie_availability(movie_id, cluster_id);

CREATE TRIGGER trg_movie_availability_updated_at
    BEFORE UPDATE ON movie_availability
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS movie_availability_history (
    history_id       BIGSERIAL     PRIMARY KEY,
    availability_id   BIGINT        NOT NULL REFERENCES movie_availability(availability_id) ON DELETE CASCADE,
    from_status       VARCHAR(20)   NULL,
    to_status         VARCHAR(20)   NOT NULL,
    actor             VARCHAR(100)  NOT NULL,
    reason            VARCHAR(500)  NULL,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_movie_availability_history_availability
    ON movie_availability_history(availability_id, created_at);

-- =============================================================================
-- 19. CINEMA CLUSTER OPERATING HOUR
-- =============================================================================
CREATE TABLE IF NOT EXISTS cinema_cluster_operating_hour (
    operating_hour_id BIGSERIAL PRIMARY KEY,
    cluster_id BIGINT NOT NULL REFERENCES cinema_cluster(cluster_id) ON DELETE CASCADE,
    day_of_week VARCHAR(9) NOT NULL
        CHECK (day_of_week IN ('MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY')),
    opens_at TIME,
    closes_at TIME,
    closes_next_day BOOLEAN NOT NULL DEFAULT FALSE,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_cluster_operating_day UNIQUE (cluster_id, day_of_week),
    CONSTRAINT chk_cluster_operating_time CHECK (
        (is_closed = TRUE AND opens_at IS NULL AND closes_at IS NULL AND closes_next_day = FALSE)
        OR (is_closed = FALSE AND opens_at IS NOT NULL AND closes_at IS NOT NULL
            AND opens_at <> closes_at
            AND (closes_next_day = TRUE OR closes_at > opens_at))
    )
);

CREATE INDEX IF NOT EXISTS idx_cluster_operating_hour_cluster
    ON cinema_cluster_operating_hour(cluster_id);

-- =============================================================================
-- 20. ROOM MASTER DATA (auditorium class / projection tech / resolution / audio)
-- =============================================================================
CREATE TABLE IF NOT EXISTS auditorium_class (
    class_id     SMALLSERIAL  PRIMARY KEY,
    class_code   VARCHAR(20)  NOT NULL UNIQUE,
    class_name   VARCHAR(100) NOT NULL,
    description  VARCHAR(255),
    active       BOOLEAN      NOT NULL DEFAULT TRUE
);

COMMENT ON TABLE auditorium_class IS
    'Commercial auditorium service tier; independent from presentation, audio, seat technology, capacity and seat mix';

CREATE TABLE IF NOT EXISTS projection_technology (
    tech_id      SMALLSERIAL  PRIMARY KEY,
    tech_code    VARCHAR(30)  NOT NULL UNIQUE,
    tech_name    VARCHAR(100) NOT NULL,
    description  VARCHAR(255),
    active       BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS resolution (
    resolution_id    SMALLSERIAL  PRIMARY KEY,
    resolution_code  VARCHAR(10)  NOT NULL UNIQUE,
    resolution_name  VARCHAR(50)  NOT NULL,
    description      VARCHAR(255),
    active           BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS audio_format (
    audio_format_id  SMALLSERIAL  PRIMARY KEY,
    format_code      VARCHAR(20)  NOT NULL UNIQUE,
    format_name      VARCHAR(100) NOT NULL,
    description      VARCHAR(255),
    active           BOOLEAN      NOT NULL DEFAULT TRUE
);

-- Database-managed room wizard templates. Physical/screen dimensions are
-- deliberately not templated because they must match engineering measurements.
CREATE TABLE IF NOT EXISTS room_configuration_template (
    template_id                    SMALLSERIAL PRIMARY KEY,
    template_code                  VARCHAR(40)  NOT NULL UNIQUE,
    template_name                  VARCHAR(100) NOT NULL,
    description                    VARCHAR(255),
    auditorium_class_id            SMALLINT     NOT NULL REFERENCES auditorium_class(class_id),
    projection_technology_id       SMALLINT     NOT NULL REFERENCES projection_technology(tech_id),
    resolution_id                  SMALLINT     NOT NULL REFERENCES resolution(resolution_id),
    audio_format_id                SMALLINT     NOT NULL REFERENCES audio_format(audio_format_id),
    supports_2d                    BOOLEAN      NOT NULL DEFAULT TRUE,
    supports_3d                    BOOLEAN      NOT NULL DEFAULT FALSE,
    default_rows                   SMALLINT     NOT NULL CHECK (default_rows BETWEEN 1 AND 50),
    default_positions_per_row      SMALLINT     NOT NULL CHECK (default_positions_per_row BETWEEN 1 AND 60),
    layout_template_code           VARCHAR(40)  NOT NULL,
    standard_row_percentage        SMALLINT     NOT NULL CHECK (standard_row_percentage BETWEEN 0 AND 100),
    couple_last_row                BOOLEAN      NOT NULL DEFAULT FALSE,
    center_aisle                   BOOLEAN      NOT NULL DEFAULT FALSE,
    cross_aisle                    BOOLEAN      NOT NULL DEFAULT FALSE,
    display_order                  SMALLINT     NOT NULL DEFAULT 0,
    active                         BOOLEAN      NOT NULL DEFAULT TRUE
);

ALTER TABLE cinema_room
    ADD COLUMN IF NOT EXISTS auditorium_class_id       SMALLINT REFERENCES auditorium_class(class_id),
    ADD COLUMN IF NOT EXISTS projection_technology_id  SMALLINT REFERENCES projection_technology(tech_id),
    ADD COLUMN IF NOT EXISTS resolution_id             SMALLINT REFERENCES resolution(resolution_id),
    ADD COLUMN IF NOT EXISTS audio_format_id           SMALLINT REFERENCES audio_format(audio_format_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_room_code_per_cluster
    ON cinema_room(cluster_id, room_code)
    WHERE room_code IS NOT NULL;

-- =============================================================================
-- 21. ROOM LAYOUT (versioned seat-layout authoring/approval)
-- =============================================================================
CREATE TABLE IF NOT EXISTS room_layout (
    room_layout_id      BIGSERIAL    PRIMARY KEY,
    cinema_room_id       BIGINT       NOT NULL REFERENCES cinema_room(cinema_room_id) ON DELETE CASCADE,
    version               INTEGER      NOT NULL,
    status                 VARCHAR(20)  NOT NULL DEFAULT 'DRAFT'
                          CONSTRAINT chk_layout_status
                              CHECK (status IN ('DRAFT','PENDING_APPROVAL','APPROVED','ACTIVE','REJECTED','SUPERSEDED')),

    number_of_rows          INTEGER     NOT NULL DEFAULT 0,
    max_positions_per_row    INTEGER     NOT NULL DEFAULT 0,
    first_row_label           VARCHAR(5)  NOT NULL DEFAULT 'A',
    numbering_direction       VARCHAR(20) NOT NULL DEFAULT 'LEFT_TO_RIGHT'
                          CONSTRAINT chk_numbering_direction
                              CHECK (numbering_direction IN ('LEFT_TO_RIGHT','RIGHT_TO_LEFT')),
    numbering_policy          VARCHAR(30) NOT NULL DEFAULT 'CONTIGUOUS_SEATS'
                          CONSTRAINT chk_numbering_policy
                              CHECK (numbering_policy IN ('CONTIGUOUS_SEATS','PHYSICAL_POSITION')),
    generator_template_code   VARCHAR(50),
    generator_template_version INTEGER,
    generation_config         TEXT,

    person_capacity            INTEGER    NOT NULL DEFAULT 0,
    sellable_unit_count         INTEGER    NOT NULL DEFAULT 0,

    submitted_at                 TIMESTAMPTZ,
    submitted_by                  VARCHAR(100),
    approved_at                    TIMESTAMPTZ,
    approved_by                     VARCHAR(100),
    rejection_reason                 TEXT,

    created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by                         VARCHAR(100),
    updated_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by                           VARCHAR(100),

    CONSTRAINT uq_room_layout_version UNIQUE (cinema_room_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_room_layout_single_active
    ON room_layout(cinema_room_id) WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_room_layout_room ON room_layout(cinema_room_id);

CREATE TRIGGER trg_room_layout_updated_at
    BEFORE UPDATE ON room_layout
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS room_layout_position (
    position_id        BIGSERIAL    PRIMARY KEY,
    room_layout_id       BIGINT       NOT NULL REFERENCES room_layout(room_layout_id) ON DELETE CASCADE,

    row_index              INTEGER      NOT NULL,
    column_index             INTEGER      NOT NULL,
    row_label                  VARCHAR(5)   NOT NULL,

    position_type               VARCHAR(20)  NOT NULL
                             CONSTRAINT chk_position_type
                                 CHECK (position_type IN ('SEAT','AISLE','EXIT','EMPTY_SPACE')),

    seat_number                   INTEGER,
    seat_code                       VARCHAR(10),
    seat_type                         VARCHAR(20)
                             CONSTRAINT chk_position_seat_type
                                 CHECK (seat_type IS NULL OR seat_type IN ('STANDARD','VIP','COUPLE','ACCESSIBLE')),
    seat_group_id                       VARCHAR(36),
    seat_status                           VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                             CONSTRAINT chk_position_seat_status
                                 CHECK (seat_status IN ('ACTIVE','INACTIVE','MAINTENANCE')),
    manual_override                       BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT uq_layout_coordinate UNIQUE (room_layout_id, row_index, column_index),
    CONSTRAINT chk_position_seat_fields CHECK (
        (position_type = 'SEAT' AND seat_number IS NOT NULL AND seat_code IS NOT NULL AND seat_type IS NOT NULL)
        OR
        (position_type <> 'SEAT' AND seat_number IS NULL AND seat_code IS NULL AND seat_type IS NULL AND seat_group_id IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_layout_seat_code
    ON room_layout_position(room_layout_id, seat_code) WHERE seat_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_layout_position_layout ON room_layout_position(room_layout_id);
CREATE INDEX IF NOT EXISTS idx_layout_position_group ON room_layout_position(seat_group_id) WHERE seat_group_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS room_layout_audit_log (
    log_id        VARCHAR(36)  PRIMARY KEY,
    room_layout_id BIGINT       NOT NULL REFERENCES room_layout(room_layout_id) ON DELETE CASCADE,
    action          VARCHAR(20)  NOT NULL,
    performed_by     VARCHAR(255),
    old_status        VARCHAR(20),
    new_status         VARCHAR(20),
    note                TEXT,
    timestamp            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_layout_audit_log_layout ON room_layout_audit_log(room_layout_id);
CREATE INDEX IF NOT EXISTS idx_room_layout_audit_log_timestamp ON room_layout_audit_log(timestamp DESC);
