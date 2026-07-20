-- =============================================================================
-- Migration V18: Cinema Room creation wizard — master data, room dimensions /
-- screen-tech fields, and versioned seat layout (room_layout / room_layout_position)
-- Run on: movie_db
-- =============================================================================
-- Additive only. Nothing existing is dropped, renamed, or backfilled away.
-- The legacy row-zone-percentage quick-create flow (numberOfRows/seatsPerRow/
-- standardRowCount/vipRowCount/coupleRowCount -> flat Seat generation) keeps
-- working exactly as before. room_layout/room_layout_position are a new,
-- versioned authoring layer that only gets synced into the operational `seat`
-- table when a layout version is explicitly ACTIVATEd (see RoomLayoutService).

-- ── 1. Master data tables (mirrors age_rating / screening_format shape) ─────

CREATE TABLE IF NOT EXISTS auditorium_class (
    class_id     SMALLSERIAL  PRIMARY KEY,
    class_code   VARCHAR(20)  NOT NULL UNIQUE,
    class_name   VARCHAR(100) NOT NULL,
    description  VARCHAR(255),
    active       BOOLEAN      NOT NULL DEFAULT TRUE
);
COMMENT ON TABLE auditorium_class IS 'Phan hang phong chieu - dimension doc lap, khong quyet dinh seat-type ratio';

INSERT INTO auditorium_class (class_code, class_name, description) VALUES
    ('STANDARD', 'Standard', 'Phong chieu tieu chuan'),
    ('PREMIUM',  'Premium',  'Phong chieu cao cap'),
    ('LUXURY',   'Luxury',   'Phong chieu hang sang'),
    ('PLF',      'Premium Large Format', 'Man hinh lon, am thanh nang cao'),
    ('MOTION',   'Motion',   'Ghe co hieu ung chuyen dong')
ON CONFLICT (class_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS projection_technology (
    tech_id      SMALLSERIAL  PRIMARY KEY,
    tech_code    VARCHAR(30)  NOT NULL UNIQUE,
    tech_name    VARCHAR(100) NOT NULL,
    description  VARCHAR(255),
    active       BOOLEAN      NOT NULL DEFAULT TRUE
);
COMMENT ON TABLE projection_technology IS 'Cong nghe trinh chieu';

INSERT INTO projection_technology (tech_code, tech_name, description) VALUES
    ('XENON',           'Xenon',           'May chieu bong den Xenon truyen thong'),
    ('LASER',           'Laser',           'May chieu laser'),
    ('DIRECT_VIEW_LED', 'Direct View LED', 'Man hinh LED chieu truc tiep, khong can may chieu')
ON CONFLICT (tech_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS resolution (
    resolution_id    SMALLSERIAL  PRIMARY KEY,
    resolution_code  VARCHAR(10)  NOT NULL UNIQUE,
    resolution_name  VARCHAR(50)  NOT NULL,
    active           BOOLEAN      NOT NULL DEFAULT TRUE
);
COMMENT ON TABLE resolution IS 'Do phan giai trinh chieu';

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
COMMENT ON TABLE audio_format IS 'Dinh dang am thanh phong chieu';

INSERT INTO audio_format (format_code, format_name) VALUES
    ('DOLBY_5_1',   'Dolby 5.1'),
    ('DOLBY_7_1',   'Dolby 7.1'),
    ('DOLBY_ATMOS', 'Dolby Atmos')
ON CONFLICT (format_code) DO NOTHING;

-- ── 2. cinema_room: room_code + physical dimensions + screen/tech fields ────
--    All nullable — legacy rooms (and the still-supported quick-create flow)
--    leave these NULL and keep working exactly as before.

ALTER TABLE cinema_room
    ADD COLUMN IF NOT EXISTS room_code               VARCHAR(20),
    ADD COLUMN IF NOT EXISTS length_m                 DECIMAL(6,2),
    ADD COLUMN IF NOT EXISTS width_m                  DECIMAL(6,2),
    ADD COLUMN IF NOT EXISTS clear_height_m            DECIMAL(6,2),
    ADD COLUMN IF NOT EXISTS auditorium_class_id       SMALLINT REFERENCES auditorium_class(class_id),
    ADD COLUMN IF NOT EXISTS projection_technology_id  SMALLINT REFERENCES projection_technology(tech_id),
    ADD COLUMN IF NOT EXISTS resolution_id             SMALLINT REFERENCES resolution(resolution_id),
    ADD COLUMN IF NOT EXISTS screen_width_m            DECIMAL(6,2),
    ADD COLUMN IF NOT EXISTS screen_height_m           DECIMAL(6,2),
    ADD COLUMN IF NOT EXISTS supports_2d               BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS supports_3d               BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS audio_format_id           SMALLINT REFERENCES audio_format(audio_format_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_room_code_per_cluster
    ON cinema_room(cluster_id, room_code)
    WHERE room_code IS NOT NULL;

COMMENT ON COLUMN cinema_room.room_code IS 'Ma phong ngan (VD "R01") do wizard tao phong chi tiet dung — null voi phong tao qua flow nhanh cu';

-- Widen room status CHECK to accept the wizard's approval-workflow states
-- alongside the existing operational states. Existing rows/values untouched.
ALTER TABLE cinema_room DROP CONSTRAINT IF EXISTS chk_room_status;
ALTER TABLE cinema_room ADD CONSTRAINT chk_room_status
    CHECK (status IN (
        'DRAFT', 'PENDING_APPROVAL', 'APPROVED',
        'ACTIVE', 'MAINTENANCE', 'TEMPORARILY_UNAVAILABLE', 'SUSPENDED', 'CLOSED', 'RETIRED'
    ));

-- ── 3. seat: seat_group_id so a Couple pair synced from an activated layout ──
--    can still be identified as one atomic unit by booking/locking.

ALTER TABLE seat
    ADD COLUMN IF NOT EXISTS seat_group_id VARCHAR(36);

CREATE INDEX IF NOT EXISTS idx_seat_group_id ON seat(seat_group_id) WHERE seat_group_id IS NOT NULL;

-- ── 4. room_layout: versioned seat-layout authoring/approval ────────────────

CREATE TABLE IF NOT EXISTS room_layout (
    room_layout_id         BIGSERIAL    PRIMARY KEY,
    cinema_room_id          BIGINT       NOT NULL REFERENCES cinema_room(cinema_room_id) ON DELETE CASCADE,
    version                  INTEGER      NOT NULL,
    status                    VARCHAR(20)  NOT NULL DEFAULT 'DRAFT'
                             CONSTRAINT chk_layout_status
                                 CHECK (status IN ('DRAFT','PENDING_APPROVAL','APPROVED','ACTIVE','REJECTED','SUPERSEDED')),

    number_of_rows             INTEGER      NOT NULL DEFAULT 0,
    max_positions_per_row       INTEGER      NOT NULL DEFAULT 0,
    first_row_label              VARCHAR(5)   NOT NULL DEFAULT 'A',
    numbering_direction          VARCHAR(20)  NOT NULL DEFAULT 'LEFT_TO_RIGHT'
                             CONSTRAINT chk_numbering_direction
                                 CHECK (numbering_direction IN ('LEFT_TO_RIGHT','RIGHT_TO_LEFT')),

    person_capacity               INTEGER     NOT NULL DEFAULT 0,
    sellable_unit_count            INTEGER     NOT NULL DEFAULT 0,

    submitted_at                    TIMESTAMPTZ,
    submitted_by                     VARCHAR(100),
    approved_at                       TIMESTAMPTZ,
    approved_by                        VARCHAR(100),
    rejection_reason                    TEXT,

    created_at                           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by                            VARCHAR(100),
    updated_at                             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by                              VARCHAR(100),

    CONSTRAINT uq_room_layout_version UNIQUE (cinema_room_id, version)
);

-- Only one ACTIVE layout per room at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_room_layout_single_active
    ON room_layout(cinema_room_id) WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_room_layout_room ON room_layout(cinema_room_id);

CREATE TRIGGER trg_room_layout_updated_at
    BEFORE UPDATE ON room_layout
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE room_layout IS 'Phien ban so do ghe cua 1 phong — DRAFT sua tu do, APPROVED/ACTIVE bat bien, sua phai clone version moi';

-- ── 5. room_layout_position: từng ô trong sơ đồ (ghế / lối đi / lối thoát / vùng trống) ──

CREATE TABLE IF NOT EXISTS room_layout_position (
    position_id       BIGSERIAL    PRIMARY KEY,
    room_layout_id      BIGINT       NOT NULL REFERENCES room_layout(room_layout_id) ON DELETE CASCADE,

    row_index             INTEGER      NOT NULL,
    column_index            INTEGER      NOT NULL,
    row_label                 VARCHAR(5)   NOT NULL,

    position_type              VARCHAR(20)  NOT NULL
                            CONSTRAINT chk_position_type
                                CHECK (position_type IN ('SEAT','AISLE','EXIT','EMPTY_SPACE')),

    seat_number                  INTEGER,
    seat_code                      VARCHAR(10),
    seat_type                        VARCHAR(20)
                            CONSTRAINT chk_position_seat_type
                                CHECK (seat_type IS NULL OR seat_type IN ('STANDARD','VIP','COUPLE','ACCESSIBLE')),
    seat_group_id                      VARCHAR(36),
    seat_status                          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                            CONSTRAINT chk_position_seat_status
                                CHECK (seat_status IN ('ACTIVE','INACTIVE','MAINTENANCE')),

    CONSTRAINT uq_layout_coordinate UNIQUE (room_layout_id, row_index, column_index),

    -- SEAT positions must carry seat_number/seat_code/seat_type; every other
    -- position type must leave them null. App layer (RoomLayoutService)
    -- re-validates this before persisting — this CHECK is the DB backstop.
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

COMMENT ON TABLE room_layout_position IS 'Tung o (cell) trong so do 1 layout version — bao gom ca AISLE/EXIT/EMPTY_SPACE, khong chi ghe ban duoc';
COMMENT ON COLUMN room_layout_position.seat_group_id IS 'Hai vi tri Couple lien ke cung hang chia se 1 gia tri — nhom atomic, khong tach le';

-- ── 6. room_layout_audit_log — mirrors cluster_audit_log ────────────────────

CREATE TABLE IF NOT EXISTS room_layout_audit_log (
    log_id           VARCHAR(36)  PRIMARY KEY,
    room_layout_id     BIGINT       NOT NULL REFERENCES room_layout(room_layout_id) ON DELETE CASCADE,
    action              VARCHAR(20)  NOT NULL,  -- CREATE, SAVE, SUBMIT, APPROVE, REJECT, ACTIVATE, CLONE
    performed_by          VARCHAR(255),
    old_status              VARCHAR(20),
    new_status                VARCHAR(20),
    note                        TEXT,
    timestamp                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_layout_audit_log_layout ON room_layout_audit_log(room_layout_id);
CREATE INDEX IF NOT EXISTS idx_room_layout_audit_log_timestamp ON room_layout_audit_log(timestamp DESC);

COMMENT ON TABLE room_layout_audit_log IS 'Lich su thay doi trang thai cua room_layout — audit trail cho approval workflow';
