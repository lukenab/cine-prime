ALTER TABLE show_time
    DROP CONSTRAINT IF EXISTS chk_show_time_price_source;

ALTER TABLE show_time
    ADD CONSTRAINT chk_show_time_price_source
        CHECK (price_source IN ('SHOWTIME_OVERRIDE', 'PRICE_BOOK', 'ROOM_DEFAULT'));
