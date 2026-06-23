\c movie_db;

-- 1. TYPE (MovieType entity → @Table name = "type")
CREATE TABLE IF NOT EXISTS type (
    type_id     BIGSERIAL    PRIMARY KEY,
    type_name   VARCHAR(255)
);

-- 2. MOVIE (Movie entity → @Table name = "movie")
CREATE TABLE IF NOT EXISTS movie (
    movie_id                  BIGSERIAL     PRIMARY KEY,
    movie_name_vn             VARCHAR(255),
    movie_name_english        VARCHAR(255),
    actor                     VARCHAR(255),
    director                  VARCHAR(255),
    content                   TEXT,
    duration                  BIGINT,
    movie_production_company  VARCHAR(255),
    version                   VARCHAR(255),
    large_image               VARCHAR(255),
    small_image               VARCHAR(255),
    status                    BOOLEAN,
    create_at                 TIMESTAMP,
    updated_at                TIMESTAMP
);

-- 3. MOVIE_MOVIE_TYPES (junction — Hibernate tự sinh từ @ManyToMany không có @JoinTable)
CREATE TABLE IF NOT EXISTS movie_movie_types (
    movie_movie_id       BIGINT  NOT NULL REFERENCES movie(movie_id) ON DELETE CASCADE,
    movie_types_type_id  BIGINT  NOT NULL REFERENCES type(type_id)   ON DELETE CASCADE,
    PRIMARY KEY (movie_movie_id, movie_types_type_id)
);

-- 4. CINEMA_ROOM (CinemaRoom entity → @Table name = "cinema_room")
CREATE TABLE IF NOT EXISTS cinema_room (
    cinema_room_id    BIGSERIAL     PRIMARY KEY,
    cinema_room_name  VARCHAR(255),
    seat_quantity     INTEGER,
    status            BOOLEAN
);

-- 5. SEAT (Seat entity → @Table name = "seat")
CREATE TABLE IF NOT EXISTS seat (
    seat_id         BIGSERIAL      PRIMARY KEY,
    cinema_room_id  BIGINT         NOT NULL REFERENCES cinema_room(cinema_room_id) ON DELETE CASCADE,
    seat_code       VARCHAR(255)   NOT NULL,
    seat_type       VARCHAR(255),
    seat_status     INTEGER        NOT NULL DEFAULT 1,
    price           DECIMAL(10,2)  NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ    DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_seat_code_room UNIQUE (cinema_room_id, seat_code)
);

CREATE INDEX IF NOT EXISTS idx_seat_cinema_room ON seat(cinema_room_id);

-- 6. SHOW_TIME (ShowTime entity → @Table name = "show_time")
CREATE TABLE IF NOT EXISTS show_time (
    showtime_id     BIGSERIAL   PRIMARY KEY,
    movie_id        BIGINT      REFERENCES movie(movie_id)             ON DELETE CASCADE,
    cinema_room_id  BIGINT      REFERENCES cinema_room(cinema_room_id) ON DELETE CASCADE,
    show_date       DATE,
    start_time      TIME,
    end_time        TIME,
    update_at       TIMESTAMP,
    -- Sprint 2 additions
    status          INTEGER     NOT NULL DEFAULT 1,
    total_seats     INTEGER     NOT NULL DEFAULT 0,
    sold_seats      INTEGER     NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_show_time_movie    ON show_time(movie_id);
CREATE INDEX IF NOT EXISTS idx_show_time_room     ON show_time(cinema_room_id);
CREATE INDEX IF NOT EXISTS idx_show_time_date     ON show_time(show_date);

-- 7. SHOWTIME_SEAT (ShowtimeSeat entity — Sprint 2 mới)
CREATE TABLE IF NOT EXISTS showtime_seat (
    showtime_seat_id     BIGSERIAL      PRIMARY KEY,
    showtime_id          BIGINT         NOT NULL REFERENCES show_time(showtime_id) ON DELETE CASCADE,
    seat_id              BIGINT         NOT NULL REFERENCES seat(seat_id),
    seat_code            VARCHAR(10)    NOT NULL,
    seat_type            VARCHAR(20)    NOT NULL DEFAULT 'NORMAL',
    price                DECIMAL(10,2)  NOT NULL,
    status               VARCHAR(20)    NOT NULL DEFAULT 'AVAILABLE',
    reserved_at          TIMESTAMP,
    reserved_expires_at  TIMESTAMP,
    CONSTRAINT uq_showtime_seat UNIQUE (showtime_id, seat_id)
);

CREATE INDEX IF NOT EXISTS idx_showtime_seat_showtime ON showtime_seat(showtime_id);
CREATE INDEX IF NOT EXISTS idx_showtime_seat_status   ON showtime_seat(showtime_id, status);
