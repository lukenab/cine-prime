-- Preserve the exact active room-layout revision used to materialize a
-- showtime's immutable sellable inventory.
ALTER TABLE showtime_seat
    ADD COLUMN IF NOT EXISTS room_layout_id BIGINT,
    ADD COLUMN IF NOT EXISTS layout_version INTEGER,
    ADD COLUMN IF NOT EXISTS seat_group_id VARCHAR(36);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_showtime_seat_room_layout'
    ) THEN
        ALTER TABLE showtime_seat
            ADD CONSTRAINT fk_showtime_seat_room_layout
            FOREIGN KEY (room_layout_id)
            REFERENCES room_layout(room_layout_id);
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_showtime_seat_layout
    ON showtime_seat(room_layout_id);

CREATE INDEX IF NOT EXISTS idx_showtime_seat_group
    ON showtime_seat(showtime_id, seat_group_id)
    WHERE seat_group_id IS NOT NULL;

-- Backfill only showtimes that have no inventory at all and whose current ACTIVE
-- layout maps completely to ACTIVE master-seat rows. Existing inventory rows are
-- intentionally left without fabricated layout provenance.
WITH eligible_showtime AS (
    SELECT st.showtime_id,
           rl.room_layout_id,
           rl.version,
           rl.person_capacity,
           rl.sellable_unit_count
    FROM show_time st
    JOIN room_layout rl
      ON rl.cinema_room_id = st.cinema_room_id
     AND rl.status = 'ACTIVE'
    WHERE NOT EXISTS (
        SELECT 1
        FROM showtime_seat existing
        WHERE existing.showtime_id = st.showtime_id
    )
      AND (
        SELECT COUNT(*)
        FROM room_layout_position position
        JOIN seat master_seat
          ON master_seat.cinema_room_id = st.cinema_room_id
         AND master_seat.row_label = position.row_label
         AND master_seat.col_number = position.column_index + 1
         AND master_seat.status = 'ACTIVE'
         AND master_seat.seat_type = position.seat_type
         AND master_seat.seat_group_id IS NOT DISTINCT FROM position.seat_group_id
        WHERE position.room_layout_id = rl.room_layout_id
          AND position.position_type = 'SEAT'
          AND position.seat_status = 'ACTIVE'
      ) = rl.sellable_unit_count
)
INSERT INTO showtime_seat (
    showtime_id,
    seat_id,
    seat_code,
    room_layout_id,
    layout_version,
    seat_type,
    seat_group_id,
    price,
    status
)
SELECT st.showtime_id,
       master_seat.seat_id,
       position.seat_code,
       eligible.room_layout_id,
       eligible.version,
       position.seat_type,
       position.seat_group_id,
       COALESCE(st.base_price, master_seat.base_price),
       'AVAILABLE'
FROM eligible_showtime eligible
JOIN show_time st
  ON st.showtime_id = eligible.showtime_id
JOIN room_layout_position position
  ON position.room_layout_id = eligible.room_layout_id
 AND position.position_type = 'SEAT'
 AND position.seat_status = 'ACTIVE'
JOIN seat master_seat
  ON master_seat.cinema_room_id = st.cinema_room_id
 AND master_seat.row_label = position.row_label
 AND master_seat.col_number = position.column_index + 1
 AND master_seat.status = 'ACTIVE'
 AND master_seat.seat_type = position.seat_type
 AND master_seat.seat_group_id IS NOT DISTINCT FROM position.seat_group_id
ON CONFLICT (showtime_id, seat_id) DO NOTHING;

UPDATE show_time st
SET total_seats = rl.person_capacity
FROM room_layout rl
WHERE rl.cinema_room_id = st.cinema_room_id
  AND rl.status = 'ACTIVE'
  AND EXISTS (
      SELECT 1
      FROM showtime_seat inventory
      WHERE inventory.showtime_id = st.showtime_id
        AND inventory.room_layout_id = rl.room_layout_id
  );

COMMENT ON COLUMN showtime_seat.room_layout_id IS
    'Active room-layout revision used to materialize this showtime inventory snapshot.';
COMMENT ON COLUMN showtime_seat.layout_version IS
    'Human-readable layout version snapshotted when the showtime inventory is materialized.';
COMMENT ON COLUMN showtime_seat.seat_group_id IS
    'Atomic sellable group snapshot, for example a Couple seat group.';
