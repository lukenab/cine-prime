-- Drops 4 columns on cinema_room that only ever held placeholder data for rooms created
-- through the (now sole) wizard/RoomLayout flow:
--   * room_type          - hardcoded to 'STANDARD' by CinemaRoomService.createWizardRoom() for
--                          every room since the old "quick create" path was removed. Real
--                          classification lives in auditorium_class_id / presentation_system.
--   * standard_row_count - hardcoded to number_of_rows by RoomLayoutService.activate()
--   * vip_row_count      - hardcoded to 0 by RoomLayoutService.activate()
--   * couple_row_count   - hardcoded to 0 by RoomLayoutService.activate()
-- Real per-row/per-seat seat-type data lives in room_layout_position.seat_type instead. The
-- only code that ever read these 3 row-count columns meaningfully (SeatService
-- .generateSeatsForRoom) is unreachable dead code - nothing calls it.
--
-- CHECK constraints referencing these columns are dropped first since some of them
-- (chk_room_row_allocation_total, chk_couple_rows_even_width) also reference columns that
-- are staying (number_of_rows, seats_per_row) and must be dropped explicitly rather than
-- relying on an implicit CASCADE from the column drop.
ALTER TABLE cinema_room DROP CONSTRAINT IF EXISTS chk_couple_rows_even_width;
ALTER TABLE cinema_room DROP CONSTRAINT IF EXISTS chk_room_has_single_seat_row;
ALTER TABLE cinema_room DROP CONSTRAINT IF EXISTS chk_room_row_allocation_non_negative;
ALTER TABLE cinema_room DROP CONSTRAINT IF EXISTS chk_room_row_allocation_total;
ALTER TABLE cinema_room DROP CONSTRAINT IF EXISTS chk_room_type;

ALTER TABLE cinema_room DROP COLUMN IF EXISTS room_type;
ALTER TABLE cinema_room DROP COLUMN IF EXISTS standard_row_count;
ALTER TABLE cinema_room DROP COLUMN IF EXISTS vip_row_count;
ALTER TABLE cinema_room DROP COLUMN IF EXISTS couple_row_count;
