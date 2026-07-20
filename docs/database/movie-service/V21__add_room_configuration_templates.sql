-- V21: Database-managed quick-start templates for the Cinema Room wizard.
-- Physical dimensions and screen dimensions are intentionally excluded because
-- they must come from the actual architectural/engineering specification.

CREATE TABLE IF NOT EXISTS room_configuration_template (
    template_id                    SMALLSERIAL PRIMARY KEY,
    template_code                  VARCHAR(40)  NOT NULL UNIQUE,
    template_name                  VARCHAR(100) NOT NULL,
    description                    VARCHAR(255),
    auditorium_class_id            SMALLINT     NOT NULL REFERENCES auditorium_class(class_id),
    projection_technology_id       SMALLINT     NOT NULL REFERENCES projection_technology(tech_id),
    resolution_id                  SMALLINT     NOT NULL REFERENCES resolution(resolution_id),
    audio_format_id                SMALLINT     NOT NULL REFERENCES audio_format(audio_format_id),
    supports_2d                    BOOLEAN      NOT NULL DEFAULT TRUE,
    supports_3d                    BOOLEAN      NOT NULL DEFAULT FALSE,
    default_rows                   SMALLINT     NOT NULL CHECK (default_rows BETWEEN 1 AND 50),
    default_positions_per_row      SMALLINT     NOT NULL CHECK (default_positions_per_row BETWEEN 1 AND 60),
    layout_template_code           VARCHAR(40)  NOT NULL,
    standard_row_percentage        SMALLINT     NOT NULL CHECK (standard_row_percentage BETWEEN 0 AND 100),
    couple_last_row                BOOLEAN      NOT NULL DEFAULT FALSE,
    center_aisle                   BOOLEAN      NOT NULL DEFAULT FALSE,
    cross_aisle                    BOOLEAN      NOT NULL DEFAULT FALSE,
    display_order                  SMALLINT     NOT NULL DEFAULT 0,
    active                         BOOLEAN      NOT NULL DEFAULT TRUE
);

COMMENT ON TABLE room_configuration_template IS
    'Versionable operational starting points for room creation; never stores physical room measurements';

INSERT INTO room_configuration_template (
    template_code, template_name, description,
    auditorium_class_id, projection_technology_id, resolution_id, audio_format_id,
    supports_2d, supports_3d, default_rows, default_positions_per_row,
    layout_template_code, standard_row_percentage, couple_last_row,
    center_aisle, cross_aisle, display_order, active
)
SELECT
    seed.template_code, seed.template_name, seed.description,
    ac.class_id, pt.tech_id, r.resolution_id, af.audio_format_id,
    seed.supports_2d, seed.supports_3d, seed.default_rows, seed.default_positions_per_row,
    seed.layout_template_code, seed.standard_row_percentage, seed.couple_last_row,
    seed.center_aisle, seed.cross_aisle, seed.display_order, TRUE
FROM (
    VALUES
        ('STANDARD_DIGITAL', 'Standard Digital',
         'Standard 2D starting point with 2K Xenon projection and Dolby 5.1',
         'STANDARD', 'XENON', '2K', 'DOLBY_5_1',
         TRUE, FALSE, 8, 10, 'ALL_STANDARD', 100, FALSE, FALSE, FALSE, 10),
        ('PREMIUM_LASER', 'Premium Laser',
         'Balanced premium room with 4K laser projection, Dolby 7.1, two side aisles and a rear Couple row',
         'PREMIUM', 'LASER', '4K', 'DOLBY_7_1',
         TRUE, TRUE, 11, 14, 'BALANCED', 40, TRUE, TRUE, FALSE, 20),
        ('LUXURY_ATMOS', 'Luxury Atmos',
         'Low-density luxury room with 4K laser projection, Dolby Atmos, paired side aisles and a complete rear Couple row',
         'LUXURY', 'LASER', '4K', 'DOLBY_ATMOS',
         TRUE, FALSE, 10, 14, 'PREMIUM', 25, TRUE, TRUE, FALSE, 30)
) AS seed(
    template_code, template_name, description,
    class_code, tech_code, resolution_code, format_code,
    supports_2d, supports_3d, default_rows, default_positions_per_row,
    layout_template_code, standard_row_percentage, couple_last_row,
    center_aisle, cross_aisle, display_order
)
JOIN auditorium_class ac ON ac.class_code = seed.class_code
JOIN projection_technology pt ON pt.tech_code = seed.tech_code
JOIN resolution r ON r.resolution_code = seed.resolution_code
JOIN audio_format af ON af.format_code = seed.format_code
ON CONFLICT (template_code) DO UPDATE SET
    template_name = EXCLUDED.template_name,
    description = EXCLUDED.description,
    auditorium_class_id = EXCLUDED.auditorium_class_id,
    projection_technology_id = EXCLUDED.projection_technology_id,
    resolution_id = EXCLUDED.resolution_id,
    audio_format_id = EXCLUDED.audio_format_id,
    supports_2d = EXCLUDED.supports_2d,
    supports_3d = EXCLUDED.supports_3d,
    default_rows = EXCLUDED.default_rows,
    default_positions_per_row = EXCLUDED.default_positions_per_row,
    layout_template_code = EXCLUDED.layout_template_code,
    standard_row_percentage = EXCLUDED.standard_row_percentage,
    couple_last_row = EXCLUDED.couple_last_row,
    center_aisle = EXCLUDED.center_aisle,
    cross_aisle = EXCLUDED.cross_aisle,
    display_order = EXCLUDED.display_order,
    active = TRUE;
