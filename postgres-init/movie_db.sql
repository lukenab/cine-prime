-- =============================================================================
-- CinePrime — movie_db v2.0  (Enterprise-grade redesign)
-- PostgreSQL 15+
-- =============================================================================
-- THAY ĐỔI SO VỚI v1:
--   1.  genre          — đổi tên từ "type" (reserved word), thêm NOT NULL/UNIQUE
--   2.  production_company — bảng riêng thay vì free-text trong movie
--   3.  person         — bảng riêng cho diễn viên / đạo diễn thay vì VARCHAR
--   4.  movie_cast     — junction: movie ↔ person + role_type + billing_order
--   5.  screening_format — bảng riêng thay vì version VARCHAR (2D/3D/IMAX/4DX)
--   6.  age_rating     — bảng tra cứu (P/K/T13/T16/T18/C theo tiêu chuẩn VN)
--   7.  movie          — status enum, CHECK duration, tmdb_id/imdb_id, audit fields
--   8.  movie_translation — đa ngôn ngữ (title + synopsis) thay vì 2 cột cố định
--   9.  movie_genre    — đổi tên từ movie_movie_types
--   10. movie_format   — junction: movie ↔ screening_format
--   11. cinema_room    — status enum, thêm maintenance_note, audit fields
--   12. cinema_room_maintenance — lịch sử bảo trì phòng chiếu
--   13. seat           — status enum, thêm row_label + col_number cho layout map
--   14. show_time      — status enum, language/subtitle, cancellation tracking, audit
--   15. showtime_seat  — thêm BLOCKED/CANCELLED status, booking_id reference
--   16. movie_action_log — đồng bộ với Java entity đã có
--   17. Overlap prevention trigger — không cho xếp lịch trùng giờ cùng phòng
--   18. updated_at auto-trigger cho tất cả bảng có cột updated_at
-- =============================================================================

\c movie_db;

-- Cần extension này cho EXCLUDE USING GIST (overlap prevention)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- =============================================================================
-- FUNCTION tiện ích: tự cập nhật updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 1. GENRE  (trước: "type" — reserved word trong SQL, không nên dùng)
-- =============================================================================
-- Business rule: admin quản lý danh sách thể loại qua dropdown, không cho nhập tay
--   → tránh "Action" / "action" / "HÀNH ĐỘNG" là 3 bản ghi khác nhau
CREATE TABLE IF NOT EXISTS genre (
    genre_id    BIGSERIAL    PRIMARY KEY,
    genre_name  VARCHAR(100) NOT NULL,
    genre_code  VARCHAR(50)  NOT NULL,          -- slug: "action", "romance" (dùng cho API filter)
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_genre_name UNIQUE (genre_name),
    CONSTRAINT uq_genre_code UNIQUE (genre_code)
);

COMMENT ON TABLE  genre IS 'Thể loại phim — admin quản lý, frontend dùng dropdown';
COMMENT ON COLUMN genre.genre_code IS 'Slug dùng cho query param: /movies?genre=action';

-- =============================================================================
-- 2. AGE RATING  (tiêu chuẩn phân loại phim Việt Nam — Thông tư 05/2023/TT-BVHTTDL)
-- =============================================================================
CREATE TABLE IF NOT EXISTS age_rating (
    rating_id    SMALLSERIAL  PRIMARY KEY,
    rating_code  VARCHAR(5)   NOT NULL UNIQUE,  -- P, K, T13, T16, T18, C
    min_age      SMALLINT     NOT NULL DEFAULT 0,
    description  VARCHAR(255) NOT NULL
);

COMMENT ON TABLE  age_rating IS 'Phân loại độ tuổi theo tiêu chuẩn Cục ĐAVT Việt Nam';
COMMENT ON COLUMN age_rating.rating_code IS 'P=Mọi lứa tuổi, K=Dưới 13 có phụ huynh, T13/T16/T18=Từ độ tuổi X, C=Cấm chiếu';

INSERT INTO age_rating (rating_code, min_age, description) VALUES
    ('P',   0,  'General audiences — suitable for all ages'),
    ('K',   0,  'Parental guidance — children under 13 must be accompanied by an adult'),
    ('T13', 13, 'Restricted to viewers 13 and older'),
    ('T16', 16, 'Restricted to viewers 16 and older'),
    ('T18', 18, 'Restricted to viewers 18 and older'),
    ('C',   0,  'Banned from public release')
ON CONFLICT (rating_code) DO NOTHING;

-- =============================================================================
-- 3. SCREENING FORMAT  (trước: version VARCHAR — không kiểm soát được)
-- =============================================================================
-- Business rule: 1 bộ phim có thể chiếu nhiều định dạng (2D, 3D, IMAX)
--   → lưu qua movie_format junction, không phải 1 cột trong movie
CREATE TABLE IF NOT EXISTS screening_format (
    format_id    SMALLSERIAL   PRIMARY KEY,
    format_code  VARCHAR(20)   NOT NULL UNIQUE,  -- 2D, 3D, IMAX, 4DX, SCREENX
    format_name  VARCHAR(100)  NOT NULL,
    description  VARCHAR(255),
    surcharge    DECIMAL(10,2) NOT NULL DEFAULT 0  -- phụ phí so với giá gốc
);

COMMENT ON TABLE  screening_format IS '2D/3D/IMAX/4DX/ScreenX — quản lý qua dropdown, không nhập tay';
COMMENT ON COLUMN screening_format.surcharge IS 'Phụ phí thêm vào giá vé cơ bản (VD: IMAX + 50.000đ)';

INSERT INTO screening_format (format_code, format_name, surcharge) VALUES
    ('2D',      '2D Standard',         0),
    ('3D',      '3D',                  30000),
    ('IMAX',    'IMAX',                50000),
    ('4DX',     '4DX',                 60000),
    ('SCREENX', 'ScreenX 270°',        40000),
    ('ATMOS',   'Dolby Atmos',         20000)
ON CONFLICT (format_code) DO NOTHING;

-- =============================================================================
-- 4. PRODUCTION COMPANY  (trước: free-text movie_production_company)
-- =============================================================================
-- Business rule: dropdown / autocomplete khi tạo phim
--   → tránh "Marvel Studios" / "marvel studios" / "MARVEL" là 3 company khác nhau
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
-- 5. PERSON  (trước: actor VARCHAR(255), director VARCHAR(255) — không normalize)
-- =============================================================================
-- Business rule: 1 phim có nhiều diễn viên/đạo diễn → cần bảng riêng
--   → tích hợp được TMDB để tự điền thông tin thay vì nhập tay
CREATE TABLE IF NOT EXISTS person (
    person_id    BIGSERIAL    PRIMARY KEY,
    full_name    VARCHAR(255) NOT NULL,
    birth_date   DATE,
    nationality  VARCHAR(100),
    photo_url    VARCHAR(500),
    biography    TEXT,
    tmdb_id      INTEGER      UNIQUE,   -- ID từ TMDB API → dùng để dedup và sync ảnh
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_person_updated_at
    BEFORE UPDATE ON person
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE  person IS 'Diễn viên, đạo diễn, biên kịch — có thể fetch từ TMDB API';
COMMENT ON COLUMN person.tmdb_id IS 'TMDB person ID — dùng để dedup khi import từ API';

-- =============================================================================
-- 6. MOVIE  (redesigned)
-- =============================================================================
-- Những gì thay đổi:
--   • status: BOOLEAN → VARCHAR enum (DRAFT/COMING_SOON/NOW_SHOWING/SUSPENDED/ENDED)
--   • duration: BIGINT → SMALLINT với CHECK (1–600 phút)
--   • movie_name_vn + movie_name_english → original_title + movie_translation table
--   • actor + director VARCHAR → xóa, dùng movie_cast junction
--   • movie_production_company VARCHAR → company_id FK → production_company
--   • version VARCHAR → xóa, dùng movie_format junction
--   • large_image/small_image → poster_url/thumbnail_url (semantic naming)
--   • thêm: tmdb_id, imdb_id, release_date, age_rating_id, trailer_url
--   • thêm: created_by, updated_by, suspended_reason
--   • sửa: create_at → created_at (typo)
CREATE TABLE IF NOT EXISTS movie (
    movie_id          BIGSERIAL     PRIMARY KEY,

    -- External identifiers — dùng để dedup và sync từ TMDB
    tmdb_id           INTEGER       UNIQUE,             -- The Movie Database ID
    imdb_id           VARCHAR(20)   UNIQUE,             -- tt1234567

    -- Tên gốc (authoritative) — các bản dịch lưu ở movie_translation
    original_title    VARCHAR(500)  NOT NULL,
    original_language CHAR(2)       NOT NULL DEFAULT 'en',  -- ISO 639-1

    -- Metadata
    duration_minutes  SMALLINT      NOT NULL
                      CONSTRAINT chk_duration CHECK (duration_minutes BETWEEN 1 AND 600),
    release_date      DATE,
    age_rating_id     SMALLINT      REFERENCES age_rating(rating_id),
    company_id        BIGINT        REFERENCES production_company(company_id),
    country           VARCHAR(100),

    -- Media
    poster_url        VARCHAR(500),     -- ảnh dọc lớn (trước: large_image)
    thumbnail_url     VARCHAR(500),     -- ảnh ngang nhỏ (trước: small_image)
    trailer_url       VARCHAR(500),     -- YouTube hoặc Cloudinary

    -- Mô tả
    synopsis          TEXT,             -- trước: content (nội dung gốc)

    -- Trạng thái vòng đời phim
    -- DRAFT          : đang soạn, chưa public
    -- PENDING_REVIEW : EMPLOYEE submit lên, chờ ADMIN duyệt
    -- REJECTED       : ADMIN từ chối, kèm rejection_note — EMPLOYEE sửa lại và submit lại
    -- COMING_SOON    : sắp chiếu — hiển thị trên trang, chưa bán vé
    -- NOW_SHOWING    : đang chiếu — cho phép tạo suất chiếu và bán vé
    -- SUSPENDED      : tạm dừng (sự cố bản quyền, kỹ thuật…) — suất chiếu mới bị chặn
    -- ENDED          : đã kết thúc — không tạo suất chiếu mới, archive
    --
    -- State machine (ai được chuyển):
    --   EMPLOYEE : DRAFT → PENDING_REVIEW
    --              REJECTED → DRAFT (sửa lại)
    --   ADMIN    : PENDING_REVIEW → COMING_SOON | NOW_SHOWING (approve)
    --              PENDING_REVIEW → REJECTED (từ chối, bắt buộc ghi rejection_note)
    --              NOW_SHOWING → SUSPENDED | ENDED
    --              SUSPENDED   → NOW_SHOWING | ENDED
    status            VARCHAR(20)   NOT NULL DEFAULT 'DRAFT'
                      CONSTRAINT chk_movie_status
                          CHECK (status IN ('DRAFT','PENDING_REVIEW','REJECTED',
                                            'COMING_SOON','NOW_SHOWING','SUSPENDED','ENDED')),
    suspended_reason  TEXT,             -- bắt buộc ghi lý do khi set SUSPENDED (validate ở service layer)
    rejection_note    TEXT,             -- bắt buộc ghi lý do khi ADMIN set REJECTED

    -- Audit
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_by        VARCHAR(100),    -- accountId của người tạo
    updated_by        VARCHAR(100)     -- accountId của người cập nhật cuối (gồm cả reviewer)
);

CREATE TRIGGER trg_movie_updated_at
    BEFORE UPDATE ON movie
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_movie_status        ON movie(status);
CREATE INDEX IF NOT EXISTS idx_movie_release_date  ON movie(release_date);
CREATE INDEX IF NOT EXISTS idx_movie_tmdb          ON movie(tmdb_id) WHERE tmdb_id IS NOT NULL;

COMMENT ON TABLE  movie IS 'Bảng phim chính — status enum kiểm soát vòng đời với review workflow';
COMMENT ON COLUMN movie.original_title    IS 'Tên phim gốc (từ nhà sản xuất hoặc TMDB). Bản dịch VN/EN lưu ở movie_translation';
COMMENT ON COLUMN movie.duration_minutes  IS 'CHECK 1–600 phút. Trước là BIGINT không có giới hạn';
COMMENT ON COLUMN movie.status            IS 'Enum: DRAFT | PENDING_REVIEW | REJECTED | COMING_SOON | NOW_SHOWING | SUSPENDED | ENDED';
COMMENT ON COLUMN movie.suspended_reason  IS 'Bắt buộc điền khi chuyển sang SUSPENDED để giải trình';
COMMENT ON COLUMN movie.rejection_note    IS 'Bắt buộc điền khi ADMIN set REJECTED. EMPLOYEE đọc lý do để sửa lại';
COMMENT ON COLUMN movie.tmdb_id           IS 'Dùng để dedup khi import phim từ TMDB API. UNIQUE constraint ngăn trùng lặp';

-- =============================================================================
-- 7. MOVIE TRANSLATION  (đa ngôn ngữ — thay thế movie_name_vn + movie_name_english)
-- =============================================================================
-- Business rule: 1 phim có thể có N bản dịch (vi, en, ko, ja, zh…)
--   Với 100 phim và 10 ngôn ngữ → 1000 dòng trong bảng này (dễ quản lý)
--   Thay vì thêm 10 cột vào movie (không scale)
CREATE TABLE IF NOT EXISTS movie_translation (
    movie_id       BIGINT       NOT NULL REFERENCES movie(movie_id) ON DELETE CASCADE,
    language_code  CHAR(2)      NOT NULL,   -- ISO 639-1: 'vi', 'en', 'ko', 'ja', 'zh'
    title          VARCHAR(500) NOT NULL,   -- tên phim trong ngôn ngữ này
    synopsis       TEXT,                   -- mô tả nội dung trong ngôn ngữ này
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    PRIMARY KEY (movie_id, language_code)
);

COMMENT ON TABLE  movie_translation IS '1 phim N ngôn ngữ. Thay thế movie_name_vn + movie_name_english';
COMMENT ON COLUMN movie_translation.language_code IS 'ISO 639-1: vi=Tiếng Việt, en=English, ko=한국어, ja=日本語';

-- Query ví dụ: lấy tên phim tiếng Việt
-- SELECT m.movie_id, mt.title AS title_vn
-- FROM movie m JOIN movie_translation mt ON m.movie_id = mt.movie_id AND mt.language_code = 'vi';

-- =============================================================================
-- 8. MOVIE GENRE  (trước: movie_movie_types — tên do Hibernate tự sinh)
-- =============================================================================
CREATE TABLE IF NOT EXISTS movie_genre (
    movie_id   BIGINT  NOT NULL REFERENCES movie(movie_id)  ON DELETE CASCADE,
    genre_id   BIGINT  NOT NULL REFERENCES genre(genre_id)  ON DELETE RESTRICT,
    PRIMARY KEY (movie_id, genre_id)
);

COMMENT ON TABLE movie_genre IS 'Junction: movie ↔ genre. Đổi tên từ movie_movie_types';

-- =============================================================================
-- 9. MOVIE FORMAT  (junction: phim được chiếu theo format nào)
-- =============================================================================
-- Business rule: phim "Avatar" vừa có 2D, 3D, IMAX → 3 dòng trong bảng này
--   Khi tạo suất chiếu, chỉ cho chọn format mà phim đó hỗ trợ
CREATE TABLE IF NOT EXISTS movie_format (
    movie_id   BIGINT   NOT NULL REFERENCES movie(movie_id)            ON DELETE CASCADE,
    format_id  SMALLINT NOT NULL REFERENCES screening_format(format_id) ON DELETE RESTRICT,
    PRIMARY KEY (movie_id, format_id)
);

COMMENT ON TABLE movie_format IS 'Phim hỗ trợ những định dạng nào (2D/3D/IMAX…). Suất chiếu phải chọn format trong danh sách này';

-- =============================================================================
-- 10. MOVIE CAST  (trước: actor VARCHAR(255), director VARCHAR(255))
-- =============================================================================
-- Business rule: 1 phim có nhiều diễn viên, 1 người có thể đóng nhiều phim
--   billing_order: thứ tự xuất hiện trong credit (1 = top billing)
CREATE TABLE IF NOT EXISTS movie_cast (
    cast_id         BIGSERIAL    PRIMARY KEY,
    movie_id        BIGINT       NOT NULL REFERENCES movie(movie_id)   ON DELETE CASCADE,
    person_id       BIGINT       NOT NULL REFERENCES person(person_id) ON DELETE RESTRICT,
    role_type       VARCHAR(20)  NOT NULL
                    CONSTRAINT chk_role_type
                        CHECK (role_type IN ('ACTOR','DIRECTOR','WRITER','PRODUCER','COMPOSER')),
    character_name  VARCHAR(255),   -- chỉ điền cho ACTOR (tên nhân vật)
    billing_order   SMALLINT,       -- thứ tự hiển thị (nhỏ hơn = đứng trước)
    CONSTRAINT uq_movie_person_role UNIQUE (movie_id, person_id, role_type)
);

CREATE INDEX IF NOT EXISTS idx_movie_cast_movie  ON movie_cast(movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_cast_person ON movie_cast(person_id);

COMMENT ON TABLE  movie_cast IS 'Diễn viên / đạo diễn / biên kịch của phim — thay thế actor VARCHAR, director VARCHAR';
COMMENT ON COLUMN movie_cast.billing_order IS '1 = top billing (diễn viên chính đứng đầu). NULL = thứ tự không quan trọng';

-- =============================================================================
-- 11. CINEMA ROOM  (redesigned)
-- =============================================================================
-- Những gì thay đổi:
--   • status: BOOLEAN → VARCHAR enum
--   • thêm: maintenance_note, room_type (đã có trong Java entity nhưng thiếu trong SQL cũ)
--   • thêm: audit fields
--   • seat_quantity đổi tên → total_seat_capacity (rõ hơn), chỉ là capacity lý thuyết
--     (số ghế thực tế active lấy từ COUNT(seat) ở service layer)
CREATE TABLE IF NOT EXISTS cinema_room (
    cinema_room_id    BIGSERIAL    PRIMARY KEY,
    cinema_room_name  VARCHAR(100) NOT NULL,

    -- Loại phòng — ảnh hưởng đến pricing và seat layout
    -- STANDARD: phòng thường  | LARGE: phòng lớn
    -- IMAX: màn hình IMAX    | 4DX: ghế rung/hiệu ứng | SCREENX: 3 màn hình
    room_type         VARCHAR(20)  NOT NULL DEFAULT 'STANDARD'
                      CONSTRAINT chk_room_type
                          CHECK (room_type IN ('STANDARD','LARGE','IMAX','4DX','SCREENX')),

    presentation_system VARCHAR(30) NOT NULL DEFAULT 'STANDARD'
                      CONSTRAINT chk_room_presentation_system
                          CHECK (presentation_system IN ('STANDARD','IMAX','DOLBY_CINEMA','SCREENX')),

    total_seat_capacity INTEGER    NOT NULL DEFAULT 0,  -- số ghế theo thiết kế (capacity)

    -- Trạng thái phòng
    -- ACTIVE                 : hoạt động bình thường
    -- MAINTENANCE            : đang bảo trì (có lịch, biết trước)
    -- TEMPORARILY_UNAVAILABLE: sự cố đột xuất (kỹ thuật, an toàn…)
    -- CLOSED                 : đóng vĩnh viễn hoặc đang cải tạo dài hạn
    status            VARCHAR(30)  NOT NULL DEFAULT 'ACTIVE'
                      CONSTRAINT chk_room_status
                          CHECK (status IN ('ACTIVE','MAINTENANCE','TEMPORARILY_UNAVAILABLE','CLOSED')),
    maintenance_note  TEXT,        -- ghi rõ lý do khi status != ACTIVE

    -- Audit
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by        VARCHAR(100),
    updated_by        VARCHAR(100)
);

CREATE TRIGGER trg_cinema_room_updated_at
    BEFORE UPDATE ON cinema_room
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON COLUMN cinema_room.status IS 'ACTIVE | MAINTENANCE | TEMPORARILY_UNAVAILABLE | CLOSED. Khi != ACTIVE thì suất chiếu mới bị chặn tạo';
COMMENT ON COLUMN cinema_room.maintenance_note IS 'Bắt buộc điền khi chuyển status khỏi ACTIVE. Ghi lý do cụ thể';

-- =============================================================================
-- 12. CINEMA ROOM MAINTENANCE  (lịch sử bảo trì — giải quyết business rule "room có sự cố")
-- =============================================================================
-- Business rule: Khi room có sự cố kỹ thuật trong khi đang chiếu:
--   1. Admin set cinema_room.status = 'TEMPORARILY_UNAVAILABLE' + ghi maintenance_note
--   2. Tạo 1 dòng trong cinema_room_maintenance để track
--   3. Service layer tự cancel tất cả show_time SCHEDULED/ON_SALE của room đó
--      (hoặc offer relocate sang phòng khác)
--   4. Khi sửa xong: set resolved = TRUE, end_time = now(), cinema_room.status = 'ACTIVE'
CREATE TABLE IF NOT EXISTS cinema_room_maintenance (
    maintenance_id  BIGSERIAL    PRIMARY KEY,
    cinema_room_id  BIGINT       NOT NULL REFERENCES cinema_room(cinema_room_id),
    reason          TEXT         NOT NULL,         -- mô tả sự cố / lý do bảo trì
    severity        VARCHAR(20)  NOT NULL DEFAULT 'MEDIUM'
                    CONSTRAINT chk_severity CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    started_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ,                   -- NULL = chưa giải quyết xong
    resolved        BOOLEAN      NOT NULL DEFAULT FALSE,
    resolution_note TEXT,                          -- ghi chú khi đóng ticket bảo trì
    created_by      VARCHAR(100) NOT NULL,         -- accountId của người ghi nhận
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_room     ON cinema_room_maintenance(cinema_room_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_resolved ON cinema_room_maintenance(resolved) WHERE resolved = FALSE;

COMMENT ON TABLE cinema_room_maintenance IS 'Lịch sử bảo trì/sự cố phòng chiếu. Khi tạo record mới → service tự cancel showtimes tương lai của phòng';

-- =============================================================================
-- 13. SEAT  (redesigned)
-- =============================================================================
-- Những gì thay đổi:
--   • seat_status: INTEGER → VARCHAR enum
--   • seat_type: VARCHAR(255) → VARCHAR(20) với CHECK constraint
--   • seat_code: VARCHAR(255) → VARCHAR(10) (A1, B12, AA1 là tối đa ~5 ký tự)
--   • thêm: row_label, col_number (để render layout map trên frontend)
CREATE TABLE IF NOT EXISTS seat (
    seat_id         BIGSERIAL     PRIMARY KEY,
    cinema_room_id  BIGINT        NOT NULL REFERENCES cinema_room(cinema_room_id) ON DELETE CASCADE,

    -- Định vị ghế trong phòng
    seat_code       VARCHAR(10)   NOT NULL,      -- VD: "A1", "B12", "VIP-C3"
    row_label       VARCHAR(5)    NOT NULL,      -- VD: "A", "B", "AA" (cho layout map)
    col_number      SMALLINT      NOT NULL,      -- VD: 1, 2, 3 (cho layout map)

    -- Loại ghế
    seat_type       VARCHAR(20)   NOT NULL DEFAULT 'STANDARD'
                    CONSTRAINT chk_seat_type
                        CHECK (seat_type IN ('STANDARD','VIP','COUPLE','SWEETBOX')),

    -- Trạng thái ghế (master status — độc lập với showtime)
    -- ACTIVE      : ghế hoạt động bình thường
    -- INACTIVE    : tạm ẩn (không tính vào capacity)
    -- MAINTENANCE : ghế hỏng/đang sửa — hiển thị trên layout nhưng không bán được
    status          VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE'
                    CONSTRAINT chk_seat_status
                        CHECK (status IN ('ACTIVE','INACTIVE','MAINTENANCE')),

    base_price      DECIMAL(10,2) NOT NULL DEFAULT 0,
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

COMMENT ON TABLE  seat IS 'Ghế vật lý trong phòng — status là trạng thái master, độc lập với showtime';
COMMENT ON COLUMN seat.row_label   IS 'Ký hiệu hàng (A, B, AA…) dùng để render sơ đồ ghế ngồi trên frontend';
COMMENT ON COLUMN seat.col_number  IS 'Số thứ tự cột dùng để render sơ đồ ghế ngồi trên frontend';
COMMENT ON COLUMN seat.status      IS 'ACTIVE=bình thường | INACTIVE=ẩn | MAINTENANCE=hỏng/đang sửa';

-- =============================================================================
-- 14. SHOW TIME  (redesigned)
-- =============================================================================
-- Những gì thay đổi:
--   • status: INTEGER → VARCHAR enum (SCHEDULED/ON_SALE/CANCELLED/COMPLETED/SUSPENDED)
--   • update_at (typo) → updated_at
--   • thêm: format_id, language_code, subtitle_code (1 phim, nhiều suất chiếu khác ngôn ngữ)
--   • thêm: cancellation_reason, cancelled_at, cancelled_by
--   • thêm: audit fields (created_at, created_by, updated_by)
--   • movie_id ON DELETE CASCADE → ON DELETE RESTRICT (xóa phim không nên xóa lịch sử chiếu)
--   • Overlap prevention: EXCLUDE USING GIST chặn 2 suất cùng phòng trùng giờ
CREATE TABLE IF NOT EXISTS show_time (
    showtime_id       BIGSERIAL     PRIMARY KEY,

    movie_id          BIGINT        NOT NULL
                      REFERENCES movie(movie_id) ON DELETE RESTRICT,  -- đổi từ CASCADE

    cinema_room_id    BIGINT        NOT NULL
                      REFERENCES cinema_room(cinema_room_id) ON DELETE RESTRICT,

    -- Định dạng chiếu: phải nằm trong danh sách movie_format của phim đó
    format_id         SMALLINT      REFERENCES screening_format(format_id),

    -- Ngôn ngữ suất chiếu này (1 phim có thể chiếu VN lồng tiếng + EN phụ đề cùng lúc)
    language_code     CHAR(2)       NOT NULL DEFAULT 'vi',  -- âm thanh: 'vi', 'en', 'ko'
    subtitle_code     CHAR(2),                              -- phụ đề: NULL = không có phụ đề

    show_date         DATE          NOT NULL,
    start_time        TIME          NOT NULL,
    end_time          TIME          NOT NULL,

    -- Giá vé cơ bản cho suất chiếu này (có thể override giá ghế)
    base_price        DECIMAL(10,2) NOT NULL DEFAULT 0,

    -- Trạng thái suất chiếu
    -- SCHEDULED  : đã lên lịch, chưa mở bán
    -- ON_SALE    : đang bán vé
    -- CANCELLED  : đã hủy (room sự cố, phim bị suspended, lý do khác)
    -- COMPLETED  : đã chiếu xong
    -- SUSPENDED  : tạm dừng bán vé (phim đang bị SUSPENDED)
    status            VARCHAR(20)   NOT NULL DEFAULT 'SCHEDULED'
                      CONSTRAINT chk_showtime_status
                          CHECK (status IN ('SCHEDULED','ON_SALE','CANCELLED','COMPLETED','SUSPENDED')),

    -- Thông tin hủy suất chiếu
    cancellation_reason TEXT,        -- lý do hủy (room hỏng, phim bị thu hồi…)
    cancelled_at        TIMESTAMPTZ,
    cancelled_by        VARCHAR(100), -- accountId admin thực hiện hủy

    -- Bộ đếm (snapshot để query nhanh — phải sync với showtime_seat)
    total_seats       INTEGER       NOT NULL DEFAULT 0,
    sold_seats        INTEGER       NOT NULL DEFAULT 0,

    -- Audit
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_by        VARCHAR(100),
    updated_by        VARCHAR(100),

    -- Validation cơ bản
    CONSTRAINT chk_showtime_times CHECK (end_time > start_time)
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_showtime_movie     ON show_time(movie_id);
CREATE INDEX IF NOT EXISTS idx_showtime_room      ON show_time(cinema_room_id);
CREATE INDEX IF NOT EXISTS idx_showtime_date      ON show_time(show_date);
CREATE INDEX IF NOT EXISTS idx_showtime_status    ON show_time(status);
-- Compound index cho query phổ biến nhất: "lấy suất chiếu của phim X ngày Y"
CREATE INDEX IF NOT EXISTS idx_showtime_movie_date ON show_time(movie_id, show_date)
    WHERE status IN ('SCHEDULED','ON_SALE');

-- ── Overlap Prevention (Business Rule) ───────────────────────────────────────
-- Chặn tạo 2 suất chiếu cùng phòng trùng giờ ở DB level
-- Sử dụng EXCLUDE USING GIST với tsrange để detect overlap
-- Chỉ check suất chưa bị hủy (CANCELLED/COMPLETED không cần check)
ALTER TABLE show_time ADD CONSTRAINT no_overlapping_showtimes
    EXCLUDE USING GIST (
        cinema_room_id WITH =,
        (daterange(show_date, show_date, '[]')) WITH &&,
        (tsrange(
            (show_date::TEXT || ' ' || start_time::TEXT)::TIMESTAMP,
            (show_date::TEXT || ' ' || end_time::TEXT)::TIMESTAMP
        )) WITH &&
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
-- 15. SHOWTIME SEAT  (redesigned)
-- =============================================================================
-- Những gì thay đổi:
--   • status thêm: BLOCKED (ghế bị chặn — bảo trì/sự cố), CANCELLED (khi showtime bị hủy)
--   • thêm: booking_id (reference sang booking_db — cross-service, không dùng FK)
CREATE TABLE IF NOT EXISTS showtime_seat (
    showtime_seat_id    BIGSERIAL      PRIMARY KEY,
    showtime_id         BIGINT         NOT NULL REFERENCES show_time(showtime_id) ON DELETE CASCADE,
    seat_id             BIGINT         NOT NULL REFERENCES seat(seat_id),

    -- Snapshot tại thời điểm tạo (không thay đổi kể cả khi seat master thay đổi)
    seat_code           VARCHAR(10)    NOT NULL,
    seat_type           VARCHAR(20)    NOT NULL DEFAULT 'STANDARD',
    price               DECIMAL(10,2)  NOT NULL,

    -- Trạng thái ghế trong suất chiếu cụ thể này
    -- AVAILABLE  : còn trống, có thể đặt
    -- RESERVED   : đang giữ tạm (chờ thanh toán) — tự hết hạn sau reserved_expires_at
    -- SOLD       : đã bán thành công (booking confirmed)
    -- BLOCKED    : bị chặn do ghế hỏng trong suất này hoặc do admin
    -- CANCELLED  : showtime bị hủy → tất cả ghế chuyển sang CANCELLED
    status              VARCHAR(20)    NOT NULL DEFAULT 'AVAILABLE'
                        CONSTRAINT chk_showtime_seat_status
                            CHECK (status IN ('AVAILABLE','RESERVED','SOLD','BLOCKED','CANCELLED')),

    reserved_at         TIMESTAMPTZ,
    reserved_expires_at TIMESTAMPTZ,   -- sau thời điểm này → tự động set lại AVAILABLE

    -- Cross-service reference (không dùng FK vì booking nằm ở booking_db)
    -- Điền khi status chuyển SOLD
    booking_id          VARCHAR(36),   -- UUID của booking trong booking-service

    CONSTRAINT uq_showtime_seat UNIQUE (showtime_id, seat_id)
);

CREATE INDEX IF NOT EXISTS idx_ss_showtime ON showtime_seat(showtime_id);
CREATE INDEX IF NOT EXISTS idx_ss_status   ON showtime_seat(showtime_id, status);
CREATE INDEX IF NOT EXISTS idx_ss_booking  ON showtime_seat(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ss_expires  ON showtime_seat(reserved_expires_at)
    WHERE status = 'RESERVED';   -- index hỗ trợ job cleanup ghế hết hạn giữ

COMMENT ON TABLE  showtime_seat IS 'Trạng thái từng ghế trong từng suất chiếu. Snapshot price + seat_code để đảm bảo tính toàn vẹn dữ liệu';
COMMENT ON COLUMN showtime_seat.booking_id          IS 'UUID từ booking-service. Không FK vì cross-database. Điền khi SOLD';
COMMENT ON COLUMN showtime_seat.reserved_expires_at IS 'Job scheduler quét mỗi 30s để giải phóng ghế RESERVED quá hạn';
COMMENT ON COLUMN showtime_seat.status IS 'AVAILABLE | RESERVED | SOLD | BLOCKED | CANCELLED';

-- =============================================================================
-- 16. MOVIE ACTION LOG  (đồng bộ với Java entity MovieActionLog đang có)
-- =============================================================================
CREATE TABLE IF NOT EXISTS movie_action_log (
    id                 VARCHAR(36)   PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    movie_id           BIGINT        REFERENCES movie(movie_id) ON DELETE SET NULL,
    account_id         VARCHAR(100)  NOT NULL,    -- người thực hiện hành động
    action_type        VARCHAR(50)   NOT NULL,    -- CREATE, UPDATE, SUSPEND, ACTIVATE, DELETE
    action_description TEXT,
    old_status         VARCHAR(20),               -- trạng thái trước khi thay đổi
    new_status         VARCHAR(20),               -- trạng thái sau khi thay đổi
    note               TEXT,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movie_log_movie   ON movie_action_log(movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_log_account ON movie_action_log(account_id);
CREATE INDEX IF NOT EXISTS idx_movie_log_time    ON movie_action_log(created_at DESC);

COMMENT ON TABLE movie_action_log IS 'Audit trail cho mọi thay đổi trên phim. Ghi lại old_status/new_status để trace vòng đời';

-- =============================================================================
-- SEED DATA — Dữ liệu mẫu cho lookup tables
-- =============================================================================

-- Thể loại phim phổ biến
INSERT INTO genre (genre_name, genre_code) VALUES
    ('Action',          'action'),
    ('Adventure',       'adventure'),
    ('Animation',       'animation'),
    ('Comedy',          'comedy'),
    ('Crime',           'crime'),
    ('Documentary',     'documentary'),
    ('Drama',           'drama'),
    ('Fantasy',         'fantasy'),
    ('Horror',          'horror'),
    ('Romance',         'romance'),
    ('Science Fiction', 'sci-fi'),
    ('Thriller',        'thriller'),
    ('War',             'war'),
    ('Psychological',   'psychological'),
    ('Family',          'family')
ON CONFLICT (genre_code) DO NOTHING;

-- =============================================================================
-- MIGRATION NOTES (so với v1)
-- =============================================================================
-- Chạy script này trên DB mới (clean install).
-- Nếu migrate từ v1 sang v2, cần:
--
-- [BREAKING CHANGES — cần migration data]
-- 1. movie.status       : BOOLEAN → VARCHAR  → UPDATE movie SET status = CASE WHEN status = TRUE THEN 'NOW_SHOWING' ELSE 'ENDED' END
-- 2. cinema_room.status : BOOLEAN → VARCHAR  → UPDATE cinema_room SET status = CASE WHEN status = TRUE THEN 'ACTIVE' ELSE 'CLOSED' END
-- 3. show_time.status   : INTEGER → VARCHAR  → UPDATE show_time SET status = CASE WHEN status = 1 THEN 'ON_SALE' WHEN status = 2 THEN 'COMPLETED' ELSE 'CANCELLED' END
-- 4. seat.seat_status   : INTEGER → VARCHAR  → UPDATE seat SET status = CASE WHEN seat_status = 1 THEN 'ACTIVE' ELSE 'INACTIVE' END
-- 5. movie.actor/director VARCHAR → DROP + tạo movie_cast records
-- 6. movie.version VARCHAR → tạo movie_format records
-- 7. movie_name_vn/english → tạo movie_translation records
-- 8. movie_movie_types → rename to movie_genre
--
-- [JAVA CODE CHANGES — cần update đồng bộ]
-- 1. Movie entity: @SQLRestriction("status = true") → @SQLRestriction("status NOT IN ('DRAFT','ENDED','SUSPENDED')")
-- 2. Movie entity: Boolean status → String status (hoặc enum MovieStatus)
-- 3. CinemaRoom entity: Boolean status → String status (hoặc enum RoomStatus)
-- 4. ShowTime entity: thêm format_id, language_code, subtitle_code, cancelled* fields
-- 5. ShowtimeSeat.SeatStatus enum: thêm BLOCKED, CANCELLED
-- 6. CreateMovieRequest: bỏ movieNameVn/English, director/actor VARCHAR, version VARCHAR
--    → thêm originalTitle, translations List<TranslationDto>, castIds List<CastDto>, formatIds List<Long>

-- =============================================================================
-- CINEMA CLUSTER SCHEMA
-- Mirrors migrations V3–V9 and V15 so a fresh movie_db has the current cluster schema.
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
    district      VARCHAR(100)  NOT NULL,
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

ALTER TABLE cinema_room
    ADD COLUMN IF NOT EXISTS cluster_id BIGINT
        REFERENCES cinema_cluster(cluster_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cinema_room_cluster ON cinema_room(cluster_id);

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

INSERT INTO cinema_cluster
        (cluster_id, cluster_code, cluster_name, venue_type, country_code, province, district,
         address, phone_number, status, latitude, longitude, timezone)
VALUES
    (1, 'CP-001', 'CinePrime Quận 1',    'MALL', 'VN', 'TP. Hồ Chí Minh', 'Quận 1',             '123 Nguyễn Huệ, Quận 1',       '19001000', 'ACTIVE',   10.7769660, 106.7009650, 'Asia/Ho_Chi_Minh'),
    (2, 'CP-002', 'CinePrime Thủ Đức',   'MALL', 'VN', 'TP. Hồ Chí Minh', 'Thành phố Thủ Đức',  '456 Võ Văn Ngân, TP. Thủ Đức', '19001000', 'ACTIVE',   10.8500000, 106.7716670, 'Asia/Ho_Chi_Minh'),
    (3, 'CP-003', 'CinePrime Hoàn Kiếm', 'MALL', 'VN', 'Hà Nội',          'Hoàn Kiếm',           '78 Hàng Bài, Hoàn Kiếm',       '19001000', 'ACTIVE',   21.0285110, 105.8341600, 'Asia/Ho_Chi_Minh'),
    (4, 'CP-004', 'CinePrime Cầu Giấy',  'MALL', 'VN', 'Hà Nội',          'Cầu Giấy',            '22 Xuân Thủy, Cầu Giấy',       '19001000', 'ACTIVE',   21.0363890, 105.7822220, 'Asia/Ho_Chi_Minh'),
    (5, 'CP-005', 'CinePrime Hải Châu',  'MALL', 'VN', 'Đà Nẵng',         'Hải Châu',            '30 Trần Phú, Hải Châu',        '19001000', 'ACTIVE',   16.0680000, 108.2120000, 'Asia/Ho_Chi_Minh'),
    (6, 'CP-006', 'CinePrime Ninh Kiều', 'MALL', 'VN', 'Cần Thơ',         'Ninh Kiều',           '15 Hai Bà Trưng, Ninh Kiều',   '19001000', 'INACTIVE', 10.0333330, 105.7833330, 'Asia/Ho_Chi_Minh')
ON CONFLICT (cluster_id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('cinema_cluster', 'cluster_id'), 6, true);

UPDATE cinema_room SET cluster_id = 1 WHERE cluster_id IS NULL;

ALTER TABLE cinema_room
    ADD CONSTRAINT uq_room_name_per_cluster
    UNIQUE (cluster_id, cinema_room_name);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cluster_name_ci
    ON cinema_cluster (LOWER(cluster_name));

CREATE UNIQUE INDEX IF NOT EXISTS uq_cluster_code_ci
    ON cinema_cluster (LOWER(cluster_code));

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

INSERT INTO cinema_cluster_operating_hour
    (cluster_id, day_of_week, opens_at, closes_at, closes_next_day, is_closed)
SELECT cluster.cluster_id, day_name, TIME '08:00', TIME '23:00', FALSE, FALSE
FROM cinema_cluster cluster
CROSS JOIN (VALUES
    ('MONDAY'), ('TUESDAY'), ('WEDNESDAY'), ('THURSDAY'),
    ('FRIDAY'), ('SATURDAY'), ('SUNDAY')
) AS days(day_name)
ON CONFLICT (cluster_id, day_of_week) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_cluster_operating_hour_cluster
    ON cinema_cluster_operating_hour(cluster_id);

-- =============================================================================
-- SEAT-ZONE / ROW-LAYOUT COLUMNS + CINEMA ROOM CREATION WIZARD SCHEMA
-- Mirrors migrations V10–V12 (seat_type ACCESSIBLE) and V13–V14 (row-zone
-- columns), which this base seed had drifted out of sync with, plus V18
-- (master data + versioned room_layout). Folded in here so a fresh
-- `docker-compose up` produces the current schema without manually replaying
-- every migration file in docs/database/movie-service/.
-- =============================================================================

ALTER TABLE seat DROP CONSTRAINT IF EXISTS chk_seat_type;
ALTER TABLE seat ADD CONSTRAINT chk_seat_type
    CHECK (seat_type IN ('STANDARD', 'VIP', 'COUPLE', 'ACCESSIBLE'));

ALTER TABLE cinema_room
    ADD COLUMN IF NOT EXISTS number_of_rows      INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS seats_per_row        INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS standard_row_count    INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS vip_row_count          INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS couple_row_count        INTEGER NOT NULL DEFAULT 0;

ALTER TABLE cinema_room
    ADD CONSTRAINT chk_room_row_allocation_non_negative
        CHECK (standard_row_count >= 0 AND vip_row_count >= 0 AND couple_row_count >= 0);

-- ── Master data tables (auditorium class / projection tech / resolution / audio) ──

CREATE TABLE IF NOT EXISTS auditorium_class (
    class_id     SMALLSERIAL  PRIMARY KEY,
    class_code   VARCHAR(20)  NOT NULL UNIQUE,
    class_name   VARCHAR(100) NOT NULL,
    description  VARCHAR(255),
    active       BOOLEAN      NOT NULL DEFAULT TRUE
);

INSERT INTO auditorium_class (class_code, class_name, description) VALUES
    ('STANDARD', 'Standard', 'Standard commercial service tier'),
    ('PREMIUM',  'Premium',  'Enhanced comfort and service tier'),
    ('LUXURY',   'Luxury',   'Luxury low-density service tier'),
    ('PRIVATE',  'Private',  'Private screening or event service tier')
ON CONFLICT (class_code) DO UPDATE SET
    class_name  = EXCLUDED.class_name,
    description = EXCLUDED.description,
    active      = TRUE;

-- PLF describes a presentation capability and MOTION describes a seat/experience
-- capability. Keep historical rows for FK compatibility, but never offer them as
-- commercial service tiers for newly created rooms.
UPDATE auditorium_class
SET active = FALSE
WHERE class_code IN ('PLF', 'MOTION');

CREATE TABLE IF NOT EXISTS projection_technology (
    tech_id      SMALLSERIAL  PRIMARY KEY,
    tech_code    VARCHAR(30)  NOT NULL UNIQUE,
    tech_name    VARCHAR(100) NOT NULL,
    description  VARCHAR(255),
    active       BOOLEAN      NOT NULL DEFAULT TRUE
);

INSERT INTO projection_technology (tech_code, tech_name, description) VALUES
    ('XENON',           'Xenon',           'Traditional xenon-lamp digital cinema projection system.'),
    ('LASER',           'Laser',           'Laser-based digital cinema projection with high brightness and stable color performance.'),
    ('DIRECT_VIEW_LED', 'Direct View LED', 'Direct-view LED cinema display that does not require a projector.')
ON CONFLICT (tech_code) DO UPDATE SET
    tech_name = EXCLUDED.tech_name,
    description = EXCLUDED.description,
    active = TRUE;

CREATE TABLE IF NOT EXISTS resolution (
    resolution_id    SMALLSERIAL  PRIMARY KEY,
    resolution_code  VARCHAR(10)  NOT NULL UNIQUE,
    resolution_name  VARCHAR(50)  NOT NULL,
    active           BOOLEAN      NOT NULL DEFAULT TRUE
);

INSERT INTO resolution (resolution_code, resolution_name) VALUES
    ('2K', '2K'),
    ('4K', '4K')
ON CONFLICT (resolution_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS audio_format (
    audio_format_id  SMALLSERIAL  PRIMARY KEY,
    format_code      VARCHAR(20)  NOT NULL UNIQUE,
    format_name      VARCHAR(100) NOT NULL,
    active           BOOLEAN      NOT NULL DEFAULT TRUE
);

INSERT INTO audio_format (format_code, format_name) VALUES
    ('DOLBY_5_1',   'Dolby 5.1'),
    ('DOLBY_7_1',   'Dolby 7.1'),
    ('DOLBY_ATMOS', 'Dolby Atmos')
ON CONFLICT (format_code) DO NOTHING;

-- Database-managed room wizard templates. Physical and screen dimensions are
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

INSERT INTO room_configuration_template (
    template_code, template_name, description,
    auditorium_class_id, projection_technology_id, resolution_id, audio_format_id,
    supports_2d, supports_3d, default_rows, default_positions_per_row,
    layout_template_code, standard_row_percentage, couple_last_row,
    center_aisle, cross_aisle, display_order, active
)
SELECT
    seed.template_code, seed.template_name, seed.description,
    ac.class_id, pt.tech_id, r.resolution_id, af.audio_format_id,
    seed.supports_2d, seed.supports_3d, seed.default_rows, seed.default_positions_per_row,
    seed.layout_template_code, seed.standard_row_percentage, seed.couple_last_row,
    seed.center_aisle, seed.cross_aisle, seed.display_order, TRUE
FROM (
    VALUES
        ('STANDARD_DIGITAL', 'Standard Digital',
         'Standard 2D starting point with 2K Xenon projection and Dolby 5.1',
         'STANDARD', 'XENON', '2K', 'DOLBY_5_1',
         TRUE, FALSE, 8, 10, 'ALL_STANDARD', 100, FALSE, FALSE, FALSE, 10),
        ('PREMIUM_LASER', 'Premium Laser',
         'Balanced premium room with 4K laser projection, Dolby 7.1, two side aisles and a rear Couple row',
         'PREMIUM', 'LASER', '4K', 'DOLBY_7_1',
         TRUE, TRUE, 11, 14, 'BALANCED', 40, TRUE, TRUE, FALSE, 20),
        ('LUXURY_ATMOS', 'Luxury Atmos',
         'Low-density luxury room with 4K laser projection, Dolby Atmos, paired side aisles and a complete rear Couple row',
         'LUXURY', 'LASER', '4K', 'DOLBY_ATMOS',
         TRUE, FALSE, 10, 14, 'PREMIUM', 25, TRUE, TRUE, FALSE, 30)
) AS seed(
    template_code, template_name, description,
    class_code, tech_code, resolution_code, format_code,
    supports_2d, supports_3d, default_rows, default_positions_per_row,
    layout_template_code, standard_row_percentage, couple_last_row,
    center_aisle, cross_aisle, display_order
)
JOIN auditorium_class ac ON ac.class_code = seed.class_code
JOIN projection_technology pt ON pt.tech_code = seed.tech_code
JOIN resolution r ON r.resolution_code = seed.resolution_code
JOIN audio_format af ON af.format_code = seed.format_code
ON CONFLICT (template_code) DO UPDATE SET
    template_name = EXCLUDED.template_name,
    description = EXCLUDED.description,
    auditorium_class_id = EXCLUDED.auditorium_class_id,
    projection_technology_id = EXCLUDED.projection_technology_id,
    resolution_id = EXCLUDED.resolution_id,
    audio_format_id = EXCLUDED.audio_format_id,
    supports_2d = EXCLUDED.supports_2d,
    supports_3d = EXCLUDED.supports_3d,
    default_rows = EXCLUDED.default_rows,
    default_positions_per_row = EXCLUDED.default_positions_per_row,
    layout_template_code = EXCLUDED.layout_template_code,
    standard_row_percentage = EXCLUDED.standard_row_percentage,
    couple_last_row = EXCLUDED.couple_last_row,
    center_aisle = EXCLUDED.center_aisle,
    cross_aisle = EXCLUDED.cross_aisle,
    display_order = EXCLUDED.display_order,
    active = TRUE;

-- ── cinema_room: room_code + physical dimensions + screen/tech fields ───────

ALTER TABLE cinema_room
    ADD COLUMN IF NOT EXISTS room_code               VARCHAR(20),
    ADD COLUMN IF NOT EXISTS length_m                 DECIMAL(6,2),
    ADD COLUMN IF NOT EXISTS width_m                  DECIMAL(6,2),
    ADD COLUMN IF NOT EXISTS clear_height_m            DECIMAL(6,2),
    ADD COLUMN IF NOT EXISTS auditorium_class_id       SMALLINT REFERENCES auditorium_class(class_id),
    ADD COLUMN IF NOT EXISTS projection_technology_id  SMALLINT REFERENCES projection_technology(tech_id),
    ADD COLUMN IF NOT EXISTS presentation_system       VARCHAR(30) NOT NULL DEFAULT 'STANDARD',
    ADD COLUMN IF NOT EXISTS resolution_id             SMALLINT REFERENCES resolution(resolution_id),
    ADD COLUMN IF NOT EXISTS screen_width_m            DECIMAL(6,2),
    ADD COLUMN IF NOT EXISTS screen_height_m           DECIMAL(6,2),
    ADD COLUMN IF NOT EXISTS supports_2d               BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS supports_3d               BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS audio_format_id           SMALLINT REFERENCES audio_format(audio_format_id);

ALTER TABLE cinema_room DROP CONSTRAINT IF EXISTS chk_room_presentation_system;
ALTER TABLE cinema_room ADD CONSTRAINT chk_room_presentation_system
    CHECK (presentation_system IN ('STANDARD', 'IMAX', 'DOLBY_CINEMA', 'SCREENX'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_room_code_per_cluster
    ON cinema_room(cluster_id, room_code)
    WHERE room_code IS NOT NULL;

ALTER TABLE cinema_room DROP CONSTRAINT IF EXISTS chk_room_status;
ALTER TABLE cinema_room ADD CONSTRAINT chk_room_status
    CHECK (status IN (
        'DRAFT', 'PENDING_APPROVAL', 'APPROVED',
        'ACTIVE', 'MAINTENANCE', 'TEMPORARILY_UNAVAILABLE', 'SUSPENDED', 'CLOSED', 'RETIRED'
    ));

ALTER TABLE seat
    ADD COLUMN IF NOT EXISTS seat_group_id VARCHAR(36);

CREATE INDEX IF NOT EXISTS idx_seat_group_id ON seat(seat_group_id) WHERE seat_group_id IS NOT NULL;

-- ── room_layout: versioned seat-layout authoring/approval ───────────────────

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

-- ── room_layout_position: từng ô trong sơ đồ ────────────────────────────────

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

-- ── room_layout_audit_log — mirrors cluster_audit_log ───────────────────────

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
