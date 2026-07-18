-- seat_quantity was superseded by total_seat_capacity (see the V2 rename noted in
-- postgres-init/movie_db.sql) but the old column was never actually dropped, so it
-- sat 100% NULL on every row. No Java or TypeScript code reads or writes it.

ALTER TABLE cinema_room
    DROP COLUMN IF EXISTS seat_quantity;
