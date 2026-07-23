-- Same gap as V32 (screening versions added after V25): rooms created after
-- V31 ran (e.g. cinema_room_id 149-151 at CinePrime Landmark 81, added later
-- via the room wizard) never got their cinema_room_format rows backfilled,
-- so Auto Schedule can only ever use the one room that existed at V31's run
-- time. Re-run V31's exact derivation logic to catch rooms added since.
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
