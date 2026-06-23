\c booking_db;

CREATE TABLE IF NOT EXISTS booking (
    booking_id        VARCHAR(36)   PRIMARY KEY,
    account_id        VARCHAR(36)   NOT NULL,
    member_id         VARCHAR(10),
    showtime_id       BIGINT        NOT NULL,
    movie_name        VARCHAR(255),
    show_date         DATE,
    start_time        TIME,
    cinema_room_name  VARCHAR(100),
    total_amount      DECIMAL(10,2) NOT NULL,
    points_used       INT           NOT NULL DEFAULT 0,
    points_discount   DECIMAL(10,2) NOT NULL DEFAULT 0,
    final_amount      DECIMAL(10,2) NOT NULL,
    booking_type      VARCHAR(20)   NOT NULL,
    status            VARCHAR(20)   NOT NULL DEFAULT 'PENDING',
    created_by        VARCHAR(36),
    created_at        TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP,
    expires_at        TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_booking_account   ON booking(account_id);
CREATE INDEX IF NOT EXISTS idx_booking_member    ON booking(member_id);
CREATE INDEX IF NOT EXISTS idx_booking_showtime  ON booking(showtime_id);
CREATE INDEX IF NOT EXISTS idx_booking_status    ON booking(status);

CREATE TABLE IF NOT EXISTS booking_detail (
    detail_id           BIGSERIAL     PRIMARY KEY,
    booking_id          VARCHAR(36)   NOT NULL REFERENCES booking(booking_id) ON DELETE CASCADE,
    showtime_seat_id    BIGINT        NOT NULL,
    seat_code           VARCHAR(10)   NOT NULL,
    seat_type           VARCHAR(20)   NOT NULL,
    unit_price          DECIMAL(10,2) NOT NULL,
    points_redeemed     INT           NOT NULL DEFAULT 0,
    is_from_points      BOOLEAN       NOT NULL DEFAULT FALSE,
    version             BIGINT        NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_booking_detail_booking ON booking_detail(booking_id);

CREATE TABLE IF NOT EXISTS ticket (
    ticket_id         VARCHAR(36)   PRIMARY KEY,
    booking_id        VARCHAR(36)   REFERENCES booking(booking_id),
    detail_id         BIGINT        REFERENCES booking_detail(detail_id),
    showtime_id       BIGINT        NOT NULL,
    movie_name        VARCHAR(255),
    cinema_room_name  VARCHAR(100),
    show_date         DATE,
    start_time        TIME,
    seat_code         VARCHAR(10),
    seat_type         VARCHAR(20),
    price             DECIMAL(10,2),
    is_from_points    BOOLEAN       NOT NULL DEFAULT FALSE,
    member_id         VARCHAR(10),
    account_id        VARCHAR(36),
    qr_code           VARCHAR(500),
    status            VARCHAR(20)   NOT NULL DEFAULT 'VALID',
    issued_at         TIMESTAMP     NOT NULL DEFAULT NOW(),
    used_at           TIMESTAMP,
    issued_by         VARCHAR(36)
);

CREATE INDEX IF NOT EXISTS idx_ticket_booking   ON ticket(booking_id);
CREATE INDEX IF NOT EXISTS idx_ticket_member    ON ticket(member_id);
CREATE INDEX IF NOT EXISTS idx_ticket_showtime  ON ticket(showtime_id);
CREATE INDEX IF NOT EXISTS idx_ticket_status    ON ticket(status);
