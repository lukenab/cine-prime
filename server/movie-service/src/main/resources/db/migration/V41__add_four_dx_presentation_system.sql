-- The screening_format catalog has always had a '4DX' row (see R__seed_reference_data.sql)
-- and it even carries scheduling metadata (showtime_allocation_format_priority), but no room
-- could ever be assigned it: cinema_room.presentation_system only allowed STANDARD/IMAX/
-- DOLBY_CINEMA/SCREENX (V1__baseline_schema.sql), so CinemaRoomService.syncRoomFormatCapabilities()
-- had no derivable code path to it. Adding FOUR_DX here is the DB-side half of closing that gap;
-- the enum movieservice.enums.PresentationSystem gets the matching Java constant.
ALTER TABLE cinema_room DROP CONSTRAINT IF EXISTS chk_room_presentation_system;
ALTER TABLE cinema_room ADD CONSTRAINT chk_room_presentation_system
    CHECK (presentation_system IN ('STANDARD', 'IMAX', 'DOLBY_CINEMA', 'SCREENX', 'FOUR_DX'));
