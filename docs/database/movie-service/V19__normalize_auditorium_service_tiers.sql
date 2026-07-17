-- =============================================================================
-- Migration V19: Normalize auditorium_class as a commercial service-tier axis.
--
-- STANDARD / PREMIUM / LUXURY / PRIVATE describe the operator's commercial
-- service tier. PLF is a presentation capability; MOTION is a seat/experience
-- capability. Historical PLF/MOTION rows are retained for FK compatibility but
-- hidden from new-room master data by setting active = FALSE.
-- =============================================================================

INSERT INTO auditorium_class (class_code, class_name, description, active) VALUES
    ('STANDARD', 'Standard', 'Standard commercial service tier', TRUE),
    ('PREMIUM',  'Premium',  'Enhanced comfort and service tier', TRUE),
    ('LUXURY',   'Luxury',   'Luxury low-density service tier', TRUE),
    ('PRIVATE',  'Private',  'Private screening or event service tier', TRUE)
ON CONFLICT (class_code) DO UPDATE SET
    class_name  = EXCLUDED.class_name,
    description = EXCLUDED.description,
    active      = TRUE;

UPDATE auditorium_class
SET active = FALSE
WHERE class_code IN ('PLF', 'MOTION');

COMMENT ON TABLE auditorium_class IS
    'Commercial auditorium service tier; independent from presentation, audio, seat technology, capacity and seat mix';
