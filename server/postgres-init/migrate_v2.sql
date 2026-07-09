-- =============================================================================
-- CinePrime — Migration v1 → v2  (chạy thủ công trên movie_db)
-- Idempotent: dùng ADD COLUMN IF NOT EXISTS và DO $$ ... $$
-- =============================================================================

-- -----------------------------------------------------------------------------
-- show_time: thêm các cột mới, fix typo update_at → updated_at
-- -----------------------------------------------------------------------------

-- Fix typo: xóa update_at nếu updated_at đã tồn tại, ngược lại thì rename
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'show_time' AND column_name = 'update_at'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'show_time' AND column_name = 'updated_at'
        ) THEN
            -- Cả hai đều tồn tại → chỉ cần xóa cột cũ
            ALTER TABLE show_time DROP COLUMN update_at;
        ELSE
            -- Chỉ có cột cũ → rename
            ALTER TABLE show_time RENAME COLUMN update_at TO updated_at;
        END IF;
    END IF;
END $$;

ALTER TABLE show_time
    ADD COLUMN IF NOT EXISTS format_id         SMALLINT       REFERENCES screening_format(format_id),
    ADD COLUMN IF NOT EXISTS language_code     CHAR(2)        NOT NULL DEFAULT 'vi',
    ADD COLUMN IF NOT EXISTS subtitle_code     CHAR(2),
    ADD COLUMN IF NOT EXISTS base_price        DECIMAL(10,2)  NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS status            VARCHAR(20)    NOT NULL DEFAULT 'SCHEDULED',
    ADD COLUMN IF NOT EXISTS total_seats       INTEGER        NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sold_seats        INTEGER        NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
    ADD COLUMN IF NOT EXISTS cancelled_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancelled_by      VARCHAR(100),
    ADD COLUMN IF NOT EXISTS created_by        VARCHAR(100),
    ADD COLUMN IF NOT EXISTS updated_by        VARCHAR(100),
    ADD COLUMN IF NOT EXISTS created_at        TIMESTAMPTZ    DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ    DEFAULT NOW();

-- CHECK constraint cho status (bỏ qua nếu đã có)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public' AND table_name = 'show_time' AND constraint_name = 'chk_showtime_status'
    ) THEN
        ALTER TABLE show_time
            ADD CONSTRAINT chk_showtime_status
            CHECK (status IN ('SCHEDULED','ON_SALE','CANCELLED','COMPLETED','SUSPENDED'));
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- showtime_seat: thêm booking_id, fix seatType default NORMAL → STANDARD
-- -----------------------------------------------------------------------------
ALTER TABLE showtime_seat
    ADD COLUMN IF NOT EXISTS booking_id VARCHAR(36);

-- Fix default sai: NORMAL không có trong CHECK constraint
UPDATE showtime_seat SET seat_type = 'STANDARD' WHERE seat_type = 'NORMAL';

-- Thêm index cho booking_id nếu chưa có
CREATE INDEX IF NOT EXISTS idx_ss_booking  ON showtime_seat(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ss_expires  ON showtime_seat(reserved_expires_at) WHERE status = 'RESERVED';

-- Thêm BLOCKED và CANCELLED vào CHECK constraint của showtime_seat
-- (PostgreSQL không hỗ trợ ALTER CONSTRAINT — phải drop và recreate)
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public' AND table_name = 'showtime_seat' AND constraint_name = 'chk_showtime_seat_status'
    ) THEN
        ALTER TABLE showtime_seat DROP CONSTRAINT chk_showtime_seat_status;
    END IF;
END $$;

ALTER TABLE showtime_seat
    ADD CONSTRAINT chk_showtime_seat_status
    CHECK (status IN ('AVAILABLE','RESERVED','SOLD','BLOCKED','CANCELLED'));

-- -----------------------------------------------------------------------------
-- cinema_room: đổi seat_quantity → total_seat_capacity nếu chưa đổi
-- -----------------------------------------------------------------------------
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'cinema_room' AND column_name = 'seat_quantity'
    ) THEN
        ALTER TABLE cinema_room RENAME COLUMN seat_quantity TO total_seat_capacity;
    END IF;
END $$;

ALTER TABLE cinema_room
    ADD COLUMN IF NOT EXISTS room_type        VARCHAR(20) NOT NULL DEFAULT 'STANDARD',
    ADD COLUMN IF NOT EXISTS maintenance_note TEXT,
    ADD COLUMN IF NOT EXISTS created_by       VARCHAR(100),
    ADD COLUMN IF NOT EXISTS updated_by       VARCHAR(100),
    ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT NOW();

-- Fix status cũ: BOOLEAN → VARCHAR
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'cinema_room'
          AND column_name = 'status'
          AND data_type = 'boolean'
    ) THEN
        ALTER TABLE cinema_room ALTER COLUMN status DROP DEFAULT;
        ALTER TABLE cinema_room ALTER COLUMN status TYPE VARCHAR(30)
            USING CASE WHEN status = TRUE THEN 'ACTIVE' ELSE 'CLOSED' END;
        ALTER TABLE cinema_room ALTER COLUMN status SET DEFAULT 'ACTIVE';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- seat: fix cột price → base_price nếu chưa đổi
-- -----------------------------------------------------------------------------
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'seat' AND column_name = 'price'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'seat' AND column_name = 'base_price'
    ) THEN
        ALTER TABLE seat RENAME COLUMN price TO base_price;
    END IF;
END $$;

-- Xóa cột seat_status cũ (INTEGER) nếu còn tồn tại
ALTER TABLE seat DROP COLUMN IF EXISTS seat_status;

-- Fix seat_type default NORMAL → STANDARD
UPDATE seat SET seat_type = 'STANDARD' WHERE seat_type = 'NORMAL';
