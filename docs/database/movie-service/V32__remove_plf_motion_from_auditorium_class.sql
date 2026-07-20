-- PLF (Premium Large Format) and MOTION describe presentation/experience
-- capabilities, not commercial service tiers, and were already deactivated
-- in V19 for that reason. They don't belong in auditorium_class at all —
-- format lives in presentation_system/projection_technology instead.
-- No cinema_room row references these class_ids (verified before deletion),
-- so a hard delete is safe.

DELETE FROM auditorium_class WHERE class_code IN ('PLF', 'MOTION');
