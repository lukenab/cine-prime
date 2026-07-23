-- The auto-showtime-generation feature (V18/V19) requires cinema_room_format
-- rows to find eligible rooms for a candidate, but that table was only ever
-- seeded for the two demo clusters (CP-Q9, CP-LA). Every other active room
-- already has real format data captured by the room creation wizard - just in
-- a different, older place: cinema_room.supports_2d / supports_3d /
-- presentation_system. Those two representations were never wired together,
-- so the algorithm sees an empty cinema_room_format table for every real room
-- even though the wizard data says exactly what that room supports.
--
-- This backfills cinema_room_format FROM that existing per-room data instead
-- of guessing a default, so it reflects what admins actually configured:
--   supports_2d = true             -> 2D
--   supports_3d = true             -> 3D
--   presentation_system = IMAX          -> IMAX
--   presentation_system = SCREENX       -> SCREENX
--   presentation_system = DOLBY_CINEMA  -> ATMOS (closest existing format code)
-- STANDARD contributes nothing extra beyond whatever supports_2d/3d say.
INSERT INTO cinema_room_format (cinema_room_id, format_id, enabled, created_by, updated_by)
SELECT cr.cinema_room_id, sf.format_id, true, 'system-backfill', 'system-backfill'
FROM cinema_room cr
JOIN screening_format sf ON sf.format_code = ANY (
    ARRAY[
        CASE WHEN cr.supports_2d THEN '2D' END,
        CASE WHEN cr.supports_3d THEN '3D' END,
        CASE cr.presentation_system
            WHEN 'IMAX' THEN 'IMAX'
            WHEN 'SCREENX' THEN 'SCREENX'
            WHEN 'DOLBY_CINEMA' THEN 'ATMOS'
            ELSE NULL
        END
    ]
)
WHERE cr.status = 'ACTIVE'
  AND NOT EXISTS (
    SELECT 1 FROM cinema_room_format crf WHERE crf.cinema_room_id = cr.cinema_room_id
  )
ON CONFLICT (cinema_room_id, format_id) DO NOTHING;
