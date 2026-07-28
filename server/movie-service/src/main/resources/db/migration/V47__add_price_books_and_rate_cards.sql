CREATE TABLE IF NOT EXISTS price_book (
    price_book_id       BIGSERIAL PRIMARY KEY,
    cluster_id          BIGINT NOT NULL REFERENCES cinema_cluster(cluster_id),
    code                VARCHAR(50) NOT NULL UNIQUE,
    name                VARCHAR(150) NOT NULL,
    currency_code       CHAR(3) NOT NULL DEFAULT 'VND',
    valid_from          DATE NOT NULL,
    valid_to            DATE,
    priority            INTEGER NOT NULL DEFAULT 0,
    status              VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    created_by          VARCHAR(100),
    updated_by          VARCHAR(100),
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_price_book_dates CHECK (valid_to IS NULL OR valid_to >= valid_from),
    CONSTRAINT chk_price_book_status CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
    CONSTRAINT chk_price_book_currency CHECK (currency_code ~ '^[A-Z]{3}$')
);

CREATE INDEX IF NOT EXISTS idx_price_book_effective
    ON price_book(cluster_id, status, valid_from, valid_to, priority DESC);

CREATE TABLE IF NOT EXISTS price_rate (
    price_rate_id           BIGSERIAL PRIMARY KEY,
    price_book_id           BIGINT NOT NULL REFERENCES price_book(price_book_id) ON DELETE CASCADE,
    name                    VARCHAR(120) NOT NULL,
    day_type                VARCHAR(20) NOT NULL DEFAULT 'ALL_DAYS',
    start_time              TIME NOT NULL,
    end_time                TIME NOT NULL,
    format_id               BIGINT REFERENCES screening_format(format_id),
    standard_price          NUMERIC(12,2) NOT NULL,
    vip_multiplier          NUMERIC(6,3) NOT NULL DEFAULT 1.250,
    couple_multiplier       NUMERIC(6,3) NOT NULL DEFAULT 1.800,
    accessible_multiplier   NUMERIC(6,3) NOT NULL DEFAULT 1.000,
    priority                INTEGER NOT NULL DEFAULT 0,
    active                  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_price_rate_day_type
        CHECK (day_type IN ('ALL_DAYS', 'WEEKDAY', 'WEEKEND')),
    CONSTRAINT chk_price_rate_price CHECK (standard_price > 0),
    CONSTRAINT chk_price_rate_multipliers CHECK (
        vip_multiplier > 0
        AND couple_multiplier > 0
        AND accessible_multiplier > 0
    )
);

CREATE INDEX IF NOT EXISTS idx_price_rate_lookup
    ON price_rate(price_book_id, active, day_type, start_time, end_time, priority DESC);

ALTER TABLE show_time
    ADD COLUMN IF NOT EXISTS price_source VARCHAR(30) NOT NULL DEFAULT 'ROOM_DEFAULT',
    ADD COLUMN IF NOT EXISTS price_book_id BIGINT REFERENCES price_book(price_book_id),
    ADD COLUMN IF NOT EXISTS price_rate_id BIGINT REFERENCES price_rate(price_rate_id);

CREATE INDEX IF NOT EXISTS idx_show_time_price_book ON show_time(price_book_id);
CREATE INDEX IF NOT EXISTS idx_show_time_price_rate ON show_time(price_rate_id);

COMMENT ON TABLE price_book IS
    'Versioned commercial ticket-price catalogue scoped to one cinema cluster.';
COMMENT ON TABLE price_rate IS
    'Rate card selected by business day, showtime start time and optional presentation format.';
COMMENT ON COLUMN show_time.price_source IS
    'SHOWTIME_OVERRIDE | PRICE_BOOK | ROOM_DEFAULT. showtime_seat.price remains the final immutable sales snapshot.';
