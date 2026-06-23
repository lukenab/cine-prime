\c movie_db;

-- Bảng SEAT (chưa có trong schema cũ)
CREATE TABLE IF NOT EXISTS seat (
    seat_id           SERIAL        PRIMARY KEY,
    cinema_room_id    INTEGER       NOT NULL,
    seat_code         VARCHAR(10)   NOT NULL,
    seat_type         VARCHAR(20)   NOT NULL DEFAULT 'NORMAL',
    seat_status       INTEGER       NOT NULL DEFAULT 1,
    price             DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cinema_room_id) REFERENCES cinema_room(cinema_room_id) ON DELETE CASCADE,
    CONSTRAINT uq_seat_code_room UNIQUE (cinema_room_id, seat_code)
);

CREATE INDEX IF NOT EXISTS idx_seat_cinema_room ON seat(cinema_room_id);

-- Mở rộng bảng SHOWTIME (thêm total_seats, sold_seats)
ALTER TABLE showtime
    ADD COLUMN IF NOT EXISTS total_seats  INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sold_seats   INTEGER NOT NULL DEFAULT 0;

-- Bảng SHOWTIME_SEAT (mới — Sprint 2)
CREATE TABLE IF NOT EXISTS showtime_seat (
    showtime_seat_id      SERIAL        PRIMARY KEY,
    showtime_id           INTEGER       NOT NULL,
    seat_id               INTEGER       NOT NULL,
    seat_code             VARCHAR(10)   NOT NULL,
    seat_type             VARCHAR(20)   NOT NULL DEFAULT 'NORMAL',
    price                 DECIMAL(10,2) NOT NULL,
    status                INTEGER       NOT NULL DEFAULT 1,
    reserved_at           TIMESTAMPTZ,
    reserved_expires_at   TIMESTAMPTZ,
    FOREIGN KEY (showtime_id) REFERENCES showtime(showtime_id) ON DELETE CASCADE,
    FOREIGN KEY (seat_id)     REFERENCES seat(seat_id),
    CONSTRAINT uq_showtime_seat UNIQUE (showtime_id, seat_id)
);

CREATE INDEX IF NOT EXISTS idx_showtime_seat_showtime ON showtime_seat(showtime_id);
CREATE INDEX IF NOT EXISTS idx_showtime_seat_status   ON showtime_seat(showtime_id, status);
