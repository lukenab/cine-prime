-- =============================================================================
-- Flyway repeatable migration: reference/seed data.
--
-- Kept separate from V1__baseline_schema.sql (pure DDL) per this repo's
-- migration convention: seed/reference data must be idempotent and independent
-- of schema changes. Flyway re-runs this automatically whenever its checksum
-- changes (e.g. you edit a description or add a row) — every statement here
-- MUST stay idempotent (ON CONFLICT DO NOTHING / DO UPDATE, or a guarded
-- INSERT ... SELECT ... WHERE NOT EXISTS).
-- =============================================================================

-- ── age_rating (Thông tư 05/2023/TT-BVHTTDL) ────────────────────────────────
INSERT INTO age_rating (rating_code, min_age, description) VALUES
    ('P',   0,  'General audiences — suitable for all ages'),
    ('K',   0,  'Parental guidance — children under 13 must be accompanied by an adult'),
    ('T13', 13, 'Restricted to viewers 13 and older'),
    ('T16', 16, 'Restricted to viewers 16 and older'),
    ('T18', 18, 'Restricted to viewers 18 and older'),
    ('C',   0,  'Banned from public release')
ON CONFLICT (rating_code) DO NOTHING;

-- ── screening_format ─────────────────────────────────────────────────────────
INSERT INTO screening_format (format_code, format_name, surcharge) VALUES
    ('2D',      '2D Standard',         0),
    ('3D',      '3D',                  30000),
    ('IMAX',    'IMAX',                50000),
    ('4DX',     '4DX',                 60000),
    ('SCREENX', 'ScreenX 270°',        40000),
    ('ATMOS',   'Dolby Atmos',         20000)
ON CONFLICT (format_code) DO NOTHING;

-- Auto Showtime simulated demand data. These are configuration rows for the
-- allocation engine; code must never branch on these cluster names or IDs.
INSERT INTO cinema_cluster
    (cluster_code, cluster_name, venue_type, country_code, province, address,
     phone_number, status, latitude, longitude, timezone, created_by, updated_by)
VALUES
    ('CP-Q9', 'CinePrime Vincom Grand Park', 'MALL', 'VN', 'TP. Ho Chi Minh',
     'Vincom Mega Mall Grand Park, District 9', '19001000', 'ACTIVE',
     10.8413000, 106.8274000, 'Asia/Ho_Chi_Minh', 'migration:R', 'migration:R'),
    ('CP-LA', 'CinePrime Long An', 'MALL', 'VN', 'Long An',
     '1 National Route 1A, Tan An', '19001000', 'ACTIVE',
     10.5359000, 106.4137000, 'Asia/Ho_Chi_Minh', 'migration:R', 'migration:R')
ON CONFLICT DO NOTHING;

INSERT INTO cinema_cluster_demand_profile
    (cluster_id, demand_tier, demand_score, min_daily_shows,
     max_daily_shows_per_movie, created_by, updated_by)
SELECT cluster_id, demand_tier, demand_score, min_daily_shows,
       max_daily_shows_per_movie, 'migration:R', 'migration:R'
FROM (
    VALUES
        ('CP-Q9', 'HIGH', 90.00::NUMERIC, 3, 12),
        ('CP-LA', 'LOW', 25.00::NUMERIC, 1, 3)
) AS seed(cluster_code, demand_tier, demand_score, min_daily_shows, max_daily_shows_per_movie)
JOIN cinema_cluster cluster ON LOWER(cluster.cluster_code) = LOWER(seed.cluster_code)
ON CONFLICT (cluster_id) DO UPDATE
SET demand_tier = EXCLUDED.demand_tier,
    demand_score = EXCLUDED.demand_score,
    min_daily_shows = EXCLUDED.min_daily_shows,
    max_daily_shows_per_movie = EXCLUDED.max_daily_shows_per_movie,
    updated_by = EXCLUDED.updated_by;

INSERT INTO cinema_room
    (cinema_room_name, room_code, room_type, presentation_system,
     total_seat_capacity, status, cluster_id, number_of_rows, seats_per_row,
     standard_row_count, vip_row_count, couple_row_count, created_by, updated_by)
SELECT seed.cinema_room_name, seed.room_code, seed.room_type,
       seed.presentation_system, seed.total_seat_capacity, 'ACTIVE',
       cluster.cluster_id, seed.number_of_rows, seed.seats_per_row,
       seed.standard_row_count, seed.vip_row_count, seed.couple_row_count,
       'migration:R', 'migration:R'
FROM (
    VALUES
        ('CP-Q9', 'IMAX 01', 'Q9-IMAX-01', 'IMAX', 'IMAX', 220, 10, 22, 8, 2, 0),
        ('CP-LA', 'Standard 01', 'LA-STD-01', 'STANDARD', 'STANDARD', 100, 10, 10, 8, 2, 0)
) AS seed(cluster_code, cinema_room_name, room_code, room_type, presentation_system,
          total_seat_capacity, number_of_rows, seats_per_row,
          standard_row_count, vip_row_count, couple_row_count)
JOIN cinema_cluster cluster ON LOWER(cluster.cluster_code) = LOWER(seed.cluster_code)
WHERE NOT EXISTS (
    SELECT 1 FROM cinema_room room
    WHERE room.cluster_id = cluster.cluster_id
      AND room.cinema_room_name = seed.cinema_room_name
);

INSERT INTO cinema_room_format
    (cinema_room_id, format_id, enabled, created_by, updated_by)
SELECT room.cinema_room_id, format.format_id, TRUE, 'migration:R', 'migration:R'
FROM (
    VALUES
        ('CP-Q9', 'IMAX 01', '2D'),
        ('CP-Q9', 'IMAX 01', '3D'),
        ('CP-Q9', 'IMAX 01', 'IMAX'),
        ('CP-LA', 'Standard 01', '2D')
) AS seed(cluster_code, cinema_room_name, format_code)
JOIN cinema_cluster cluster ON LOWER(cluster.cluster_code) = LOWER(seed.cluster_code)
JOIN cinema_room room ON room.cluster_id = cluster.cluster_id
    AND room.cinema_room_name = seed.cinema_room_name
JOIN screening_format format ON format.format_code = seed.format_code
ON CONFLICT (cinema_room_id, format_id) DO UPDATE
SET enabled = EXCLUDED.enabled,
    updated_by = EXCLUDED.updated_by;

INSERT INTO showtime_allocation_policy
    (policy_code, peak_demand_weight, movie_demand_weight, cluster_demand_weight,
     time_slot_demand_weight, format_demand_weight, room_capacity_weight,
     minimum_coverage, maximum_room_share, active, created_by, updated_by)
VALUES
    ('DEFAULT', 1.2000, 0.4000, 0.2500, 0.1500, 0.1000, 0.1000,
     1, 0.6000, TRUE, 'migration:R', 'migration:R')
ON CONFLICT (policy_code) DO UPDATE
SET peak_demand_weight = EXCLUDED.peak_demand_weight,
    movie_demand_weight = EXCLUDED.movie_demand_weight,
    cluster_demand_weight = EXCLUDED.cluster_demand_weight,
    time_slot_demand_weight = EXCLUDED.time_slot_demand_weight,
    format_demand_weight = EXCLUDED.format_demand_weight,
    room_capacity_weight = EXCLUDED.room_capacity_weight,
    minimum_coverage = EXCLUDED.minimum_coverage,
    maximum_room_share = EXCLUDED.maximum_room_share,
    active = EXCLUDED.active,
    updated_by = EXCLUDED.updated_by;

-- ── genre ────────────────────────────────────────────────────────────────────
INSERT INTO showtime_allocation_format_priority
    (policy_id, format_id, allocation_priority, created_by, updated_by)
SELECT policy.policy_id, format.format_id, seed.allocation_priority,
       'migration:R', 'migration:R'
FROM (
    VALUES ('IMAX', 100), ('4DX', 90), ('SCREENX', 80), ('3D', 70), ('2D', 10)
) AS seed(format_code, allocation_priority)
JOIN showtime_allocation_policy policy ON policy.policy_code = 'DEFAULT'
JOIN screening_format format ON format.format_code = seed.format_code
ON CONFLICT (policy_id, format_id) DO UPDATE
SET allocation_priority = EXCLUDED.allocation_priority,
    updated_by = EXCLUDED.updated_by;

INSERT INTO genre (genre_name, genre_code) VALUES
    ('Action',          'action'),
    ('Adventure',       'adventure'),
    ('Animation',       'animation'),
    ('Comedy',          'comedy'),
    ('Crime',           'crime'),
    ('Documentary',     'documentary'),
    ('Drama',           'drama'),
    ('Fantasy',         'fantasy'),
    ('Horror',          'horror'),
    ('Romance',         'romance'),
    ('Science Fiction', 'sci-fi'),
    ('Thriller',        'thriller'),
    ('War',             'war'),
    ('Psychological',   'psychological'),
    ('Family',          'family')
ON CONFLICT (genre_code) DO NOTHING;

-- ── cinema_cluster (demo/sample locations) ───────────────────────────────────
-- Guarded by NOT EXISTS rather than ON CONFLICT (cluster_id) DO NOTHING: a
-- database that's been in real use (cluster codes/names renumbered, mock rows
-- edited or deleted, ids well past 6) can easily have some *other* row already
-- holding one of these codes/names even though cluster_id 1-6 themselves are
-- free — that would violate uq_cluster_code_ci/uq_cluster_name_ci even though
-- the ON CONFLICT target (cluster_id) never fires. Skipping the whole batch
-- when ANY of these codes/names are already taken anywhere is the correct,
-- safe behavior — this seed only makes sense for a genuinely fresh database.
INSERT INTO cinema_cluster
        (cluster_id, cluster_code, cluster_name, venue_type, country_code, province,
         address, phone_number, status, latitude, longitude, timezone)
SELECT * FROM (VALUES
    (1, 'CP-001', 'CinePrime Quận 1',    'MALL', 'VN', 'TP. Hồ Chí Minh', '123 Nguyễn Huệ, Quận 1',       '19001000', 'ACTIVE',   10.7769660, 106.7009650, 'Asia/Ho_Chi_Minh'),
    (2, 'CP-002', 'CinePrime Thủ Đức',   'MALL', 'VN', 'TP. Hồ Chí Minh', '456 Võ Văn Ngân, TP. Thủ Đức', '19001000', 'ACTIVE',   10.8500000, 106.7716670, 'Asia/Ho_Chi_Minh'),
    (3, 'CP-003', 'CinePrime Hoàn Kiếm', 'MALL', 'VN', 'Hà Nội',          '78 Hàng Bài, Hoàn Kiếm',       '19001000', 'ACTIVE',   21.0285110, 105.8341600, 'Asia/Ho_Chi_Minh'),
    (4, 'CP-004', 'CinePrime Cầu Giấy',  'MALL', 'VN', 'Hà Nội',          '22 Xuân Thủy, Cầu Giấy',       '19001000', 'ACTIVE',   21.0363890, 105.7822220, 'Asia/Ho_Chi_Minh'),
    (5, 'CP-005', 'CinePrime Hải Châu',  'MALL', 'VN', 'Đà Nẵng',         '30 Trần Phú, Hải Châu',        '19001000', 'ACTIVE',   16.0680000, 108.2120000, 'Asia/Ho_Chi_Minh'),
    (6, 'CP-006', 'CinePrime Ninh Kiều', 'MALL', 'VN', 'Cần Thơ',         '15 Hai Bà Trưng, Ninh Kiều',   '19001000', 'INACTIVE', 10.0333330, 105.7833330, 'Asia/Ho_Chi_Minh')
) AS seed(cluster_id, cluster_code, cluster_name, venue_type, country_code, province,
          address, phone_number, status, latitude, longitude, timezone)
WHERE NOT EXISTS (
    SELECT 1 FROM cinema_cluster c
    WHERE c.cluster_id IN (1, 2, 3, 4, 5, 6)
       OR LOWER(c.cluster_code) IN ('cp-001', 'cp-002', 'cp-003', 'cp-004', 'cp-005', 'cp-006')
       OR LOWER(c.cluster_name) IN (
              LOWER('CinePrime Quận 1'), LOWER('CinePrime Thủ Đức'), LOWER('CinePrime Hoàn Kiếm'),
              LOWER('CinePrime Cầu Giấy'), LOWER('CinePrime Hải Châu'), LOWER('CinePrime Ninh Kiều')
          )
);

-- Never move the sequence backwards — only bump it up to the current max, so
-- this is a no-op (and never causes a future collision) on a database that
-- already has clusters with ids beyond 6.
SELECT setval(
    pg_get_serial_sequence('cinema_cluster', 'cluster_id'),
    GREATEST((SELECT COALESCE(MAX(cluster_id), 0) FROM cinema_cluster), 6),
    true
);

-- Assign any pre-existing/legacy room rows with no cluster to cluster 1.
UPDATE cinema_room SET cluster_id = 1 WHERE cluster_id IS NULL;

-- Default operating hours (08:00-23:00 every day) for every cluster that doesn't have any yet.
INSERT INTO cinema_cluster_operating_hour
    (cluster_id, day_of_week, opens_at, closes_at, closes_next_day, is_closed)
SELECT cluster.cluster_id, day_name, TIME '08:00', TIME '23:00', FALSE, FALSE
FROM cinema_cluster cluster
CROSS JOIN (VALUES
    ('MONDAY'), ('TUESDAY'), ('WEDNESDAY'), ('THURSDAY'),
    ('FRIDAY'), ('SATURDAY'), ('SUNDAY')
) AS days(day_name)
ON CONFLICT (cluster_id, day_of_week) DO NOTHING;

-- ── auditorium_class (commercial service tier) ───────────────────────────────
INSERT INTO auditorium_class (class_code, class_name, description) VALUES
    ('STANDARD', 'Standard', 'Standard commercial service tier'),
    ('PREMIUM',  'Premium',  'Enhanced comfort and service tier'),
    ('LUXURY',   'Luxury',   'Luxury low-density service tier'),
    ('PRIVATE',  'Private',  'Private screening or event service tier')
ON CONFLICT (class_code) DO UPDATE SET
    class_name  = EXCLUDED.class_name,
    description = EXCLUDED.description,
    active      = TRUE;

-- ── projection_technology ─────────────────────────────────────────────────────
INSERT INTO projection_technology (tech_code, tech_name, description) VALUES
    ('XENON',           'Xenon',           'Traditional xenon-lamp digital cinema projection system.'),
    ('LASER',           'Laser',           'Laser-based digital cinema projection with high brightness and stable color performance.'),
    ('DIRECT_VIEW_LED', 'Direct View LED', 'Direct-view LED cinema display that does not require a projector.')
ON CONFLICT (tech_code) DO UPDATE SET
    tech_name = EXCLUDED.tech_name,
    description = EXCLUDED.description,
    active = TRUE;

-- ── resolution ─────────────────────────────────────────────────────────────────
INSERT INTO resolution (resolution_code, resolution_name, description) VALUES
    ('2K', '2K', '2K digital cinema projection resolution (approximately 2048x1080).'),
    ('4K', '4K', '4K digital cinema projection resolution (approximately 4096x2160), sharper detail than 2K.')
ON CONFLICT (resolution_code) DO UPDATE SET
    resolution_name = EXCLUDED.resolution_name,
    description = EXCLUDED.description,
    active = TRUE;

-- ── audio_format ───────────────────────────────────────────────────────────────
INSERT INTO audio_format (format_code, format_name, description) VALUES
    ('DOLBY_5_1',   'Dolby 5.1',   'Dolby 5.1 surround sound with six discrete channels.'),
    ('DOLBY_7_1',   'Dolby 7.1',   'Dolby 7.1 surround sound with eight discrete channels for wider surround coverage.'),
    ('DOLBY_ATMOS', 'Dolby Atmos', 'Dolby Atmos object-based immersive audio with overhead sound channels.')
ON CONFLICT (format_code) DO UPDATE SET
    format_name = EXCLUDED.format_name,
    description = EXCLUDED.description,
    active = TRUE;

-- ── room_configuration_template (wizard quick-start templates) ────────────────
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
