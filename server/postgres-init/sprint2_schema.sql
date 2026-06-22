-- ============================================================
-- SPRINT 2: Showtime Management & Ticket Booking
-- ============================================================

-- ------------------------------------------------------------
-- movie_db: Mở rộng bảng show_time
-- ------------------------------------------------------------
ALTER TABLE show_time
    ADD COLUMN IF NOT EXISTS status        VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS total_seats   INT          NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sold_seats    INT          NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS created_at    TIMESTAMP             DEFAULT NOW();

COMMENT ON COLUMN show_time.status      IS 'ACTIVE | CANCELLED';
COMMENT ON COLUMN show_time.total_seats IS 'Tổng số ghế của phòng chiếu tại thời điểm tạo suất chiếu';
COMMENT ON COLUMN show_time.sold_seats  IS 'Số ghế đã bán (cache, tăng khi xác nhận booking)';

-- ------------------------------------------------------------
-- movie_db: Bảng mới — showtime_seat
-- Theo dõi trạng thái từng ghế cho từng suất chiếu
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS showtime_seat (
    showtime_seat_id      BIGSERIAL     PRIMARY KEY,
    showtime_id           BIGINT        NOT NULL REFERENCES show_time(showtime_id) ON DELETE CASCADE,
    seat_id               BIGINT        NOT NULL REFERENCES seat(seat_id),
    seat_code             VARCHAR(10)   NOT NULL,
    seat_type             VARCHAR(20)   NOT NULL,                   -- NORMAL | VIP
    price                 DECIMAL(10,2) NOT NULL,
    status                VARCHAR(20)   NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE | RESERVED | SOLD
    reserved_at           TIMESTAMP,                                -- thời điểm bắt đầu giữ chỗ
    reserved_expires_at   TIMESTAMP,                                -- hết hạn giữ chỗ (vd: +15 phút)
    CONSTRAINT uq_showtime_seat UNIQUE (showtime_id, seat_id)
);

CREATE INDEX IF NOT EXISTS idx_showtime_seat_showtime ON showtime_seat(showtime_id);
CREATE INDEX IF NOT EXISTS idx_showtime_seat_status   ON showtime_seat(showtime_id, status);

COMMENT ON TABLE showtime_seat IS
    'Trạng thái từng ghế cho mỗi suất chiếu. '
    'Được sinh tự động khi tạo show_time mới (dựa trên danh sách ghế của cinema_room).';

-- ============================================================
-- booking_db
-- ============================================================

-- ------------------------------------------------------------
-- booking: Đơn đặt vé (online) hoặc bán vé (tại quầy)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking (
    booking_id        VARCHAR(36)   PRIMARY KEY,                   -- UUID
    account_id        VARCHAR(36)   NOT NULL,                      -- FK → auth_db.account
    member_id         VARCHAR(10),                                 -- nullable (khách vãng lai)
    showtime_id       BIGINT        NOT NULL,                      -- ref movie_db.show_time

    -- Snapshot thông tin lịch chiếu (lưu lại để hiển thị lịch sử)
    movie_name        VARCHAR(255),
    show_date         DATE,
    start_time        TIME,
    cinema_room_name  VARCHAR(100),

    -- Tài chính
    total_amount      DECIMAL(10,2) NOT NULL,
    points_used       INT           NOT NULL DEFAULT 0,
    points_discount   DECIMAL(10,2) NOT NULL DEFAULT 0,
    final_amount      DECIMAL(10,2) NOT NULL,

    -- Metadata
    booking_type      VARCHAR(20)   NOT NULL,                      -- ONLINE | COUNTER
    status            VARCHAR(20)   NOT NULL DEFAULT 'PENDING',    -- PENDING | CONFIRMED | CANCELLED | EXPIRED | CONVERTED
    created_by        VARCHAR(36),                                 -- account_id người tạo (nhân viên hoặc chính member)
    created_at        TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP,
    expires_at        TIMESTAMP                                    -- PENDING tự hủy sau 15 phút nếu chưa xác nhận
);

CREATE INDEX IF NOT EXISTS idx_booking_account    ON booking(account_id);
CREATE INDEX IF NOT EXISTS idx_booking_member     ON booking(member_id);
CREATE INDEX IF NOT EXISTS idx_booking_showtime   ON booking(showtime_id);
CREATE INDEX IF NOT EXISTS idx_booking_status     ON booking(status);

COMMENT ON COLUMN booking.status IS
    'PENDING     = member đã chọn ghế, chưa xác nhận (ghế đang RESERVED)
     CONFIRMED   = đã xác nhận tại quầy, vé đã được phát hành
     CANCELLED   = hủy bởi member hoặc nhân viên
     EXPIRED     = quá 15 phút không xác nhận (PENDING → EXPIRED)
     CONVERTED   = đã chuyển thành ticket (legacy từ quầy)';

-- ------------------------------------------------------------
-- booking_detail: Chi tiết từng ghế trong booking
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_detail (
    detail_id           BIGSERIAL     PRIMARY KEY,
    booking_id          VARCHAR(36)   NOT NULL REFERENCES booking(booking_id) ON DELETE CASCADE,
    showtime_seat_id    BIGINT        NOT NULL,                    -- ref movie_db.showtime_seat

    -- Snapshot ghế (tránh join sang movie_db khi xem lịch sử)
    seat_code           VARCHAR(10)   NOT NULL,
    seat_type           VARCHAR(20)   NOT NULL,                    -- NORMAL | VIP
    unit_price          DECIMAL(10,2) NOT NULL,
    points_redeemed     INT           NOT NULL DEFAULT 0,          -- điểm dùng cho ghế này
    is_from_points      BOOLEAN       NOT NULL DEFAULT FALSE,      -- vé này thanh toán bằng điểm

    version             BIGINT        NOT NULL DEFAULT 0           -- optimistic locking
);

CREATE INDEX IF NOT EXISTS idx_booking_detail_booking ON booking_detail(booking_id);

-- ------------------------------------------------------------
-- ticket: Vé đã phát hành (sau khi confirm booking hoặc bán trực tiếp)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket (
    ticket_id         VARCHAR(36)   PRIMARY KEY,                   -- UUID
    booking_id        VARCHAR(36)   REFERENCES booking(booking_id), -- nullable (bán trực tiếp không qua booking)
    detail_id         BIGINT        REFERENCES booking_detail(detail_id),

    -- Ref sang movie_db (không FK vì cross-service)
    showtime_id       BIGINT        NOT NULL,

    -- Snapshot thông tin vé (bất biến sau khi phát hành)
    movie_name        VARCHAR(255),
    cinema_room_name  VARCHAR(100),
    show_date         DATE,
    start_time        TIME,
    seat_code         VARCHAR(10),
    seat_type         VARCHAR(20),
    price             DECIMAL(10,2),
    is_from_points    BOOLEAN       NOT NULL DEFAULT FALSE,

    -- Thông tin người mua
    member_id         VARCHAR(10),
    account_id        VARCHAR(36),

    -- QR / barcode
    qr_code           VARCHAR(500),

    -- Trạng thái
    status            VARCHAR(20)   NOT NULL DEFAULT 'VALID',      -- VALID | USED | CANCELLED
    issued_at         TIMESTAMP     NOT NULL DEFAULT NOW(),
    used_at           TIMESTAMP,
    issued_by         VARCHAR(36)                                  -- account_id nhân viên phát vé
);

CREATE INDEX IF NOT EXISTS idx_ticket_booking    ON ticket(booking_id);
CREATE INDEX IF NOT EXISTS idx_ticket_member     ON ticket(member_id);
CREATE INDEX IF NOT EXISTS idx_ticket_showtime   ON ticket(showtime_id);
CREATE INDEX IF NOT EXISTS idx_ticket_status     ON ticket(status);

COMMENT ON TABLE ticket IS
    'Vé được phát hành theo 2 luồng:
     1. Bán trực tiếp (COUNTER): Employee chọn suất → ghế → xác nhận → ticket tạo ngay.
     2. Từ booking online: Member đặt trước (PENDING) → Employee xác nhận tại quầy → ticket tạo.
     Dữ liệu snapshot để đảm bảo tính bất biến kể cả khi movie/showtime bị sửa sau.';
