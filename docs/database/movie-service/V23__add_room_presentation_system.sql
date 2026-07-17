-- P0 auditorium visualization: persist the commercial presentation system
-- separately from projection technology and presentation format (2D/3D).

ALTER TABLE cinema_room
    ADD COLUMN IF NOT EXISTS presentation_system VARCHAR(30) NOT NULL DEFAULT 'STANDARD';

ALTER TABLE cinema_room
    DROP CONSTRAINT IF EXISTS chk_room_presentation_system;

ALTER TABLE cinema_room
    ADD CONSTRAINT chk_room_presentation_system
        CHECK (presentation_system IN ('STANDARD', 'IMAX', 'DOLBY_CINEMA', 'SCREENX'));

COMMENT ON COLUMN cinema_room.presentation_system IS
    'Commercial auditorium system. Independent from projector light source: STANDARD, IMAX, DOLBY_CINEMA or SCREENX.';
