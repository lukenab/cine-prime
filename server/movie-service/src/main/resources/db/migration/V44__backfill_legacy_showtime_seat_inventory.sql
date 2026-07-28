-- Materialize inventory for legacy showtimes created before V43.
-- Only fully mapped ACTIVE layouts are eligible. Partial inventory is never
-- written: a mismatched room remains visible to operations for explicit repair.
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
