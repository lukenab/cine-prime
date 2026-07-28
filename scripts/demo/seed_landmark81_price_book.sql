-- Demo commercial configuration for CinePrime Landmark 81.
-- Safe to rerun: it owns only the code L81-REGULAR-2026-H2.
-- These are project demo prices, not an official price list of another cinema brand.

BEGIN;

INSERT INTO price_book (
    cluster_id, code, name, currency_code,
    valid_from, valid_to, priority, status,
    created_by, updated_by
)
SELECT
    cluster_id,
    'L81-REGULAR-2026-H2',
    'Landmark 81 Regular Rates - 2026 H2',
    'VND',
    DATE '2026-07-27',
    DATE '2026-12-31',
    100,
    'ACTIVE',
    'SYSTEM:DEMO_SEED',
    'SYSTEM:DEMO_SEED'
FROM cinema_cluster
WHERE cluster_code = 'CP-023'
ON CONFLICT (code) DO UPDATE SET
    cluster_id = EXCLUDED.cluster_id,
    name = EXCLUDED.name,
    currency_code = EXCLUDED.currency_code,
    valid_from = EXCLUDED.valid_from,
    valid_to = EXCLUDED.valid_to,
    priority = EXCLUDED.priority,
    status = EXCLUDED.status,
    updated_by = EXCLUDED.updated_by,
    updated_at = CURRENT_TIMESTAMP;

DELETE FROM price_rate
WHERE price_book_id = (
    SELECT price_book_id
    FROM price_book
    WHERE code = 'L81-REGULAR-2026-H2'
);

WITH target_book AS (
    SELECT price_book_id
    FROM price_book
    WHERE code = 'L81-REGULAR-2026-H2'
),
rate_input (
    name, day_type, start_time, end_time, format_code,
    standard_price, vip_multiplier, couple_multiplier,
    accessible_multiplier, priority
) AS (
    VALUES
        ('Weekday off-peak', 'WEEKDAY', TIME '08:00', TIME '16:59:59', NULL,
            75000.00, 1.200, 2.000, 1.000, 10),
        ('Weekday prime', 'WEEKDAY', TIME '17:00', TIME '23:59:59', NULL,
            90000.00, 1.200, 2.000, 1.000, 20),
        ('Weekend daytime', 'WEEKEND', TIME '08:00', TIME '16:59:59', NULL,
            95000.00, 1.200, 2.000, 1.000, 10),
        ('Weekend prime', 'WEEKEND', TIME '17:00', TIME '23:59:59', NULL,
            110000.00, 1.200, 2.000, 1.000, 20),

        ('3D weekday', 'WEEKDAY', TIME '08:00', TIME '23:59:59', '3D',
            110000.00, 1.200, 2.000, 1.000, 100),
        ('3D weekend', 'WEEKEND', TIME '08:00', TIME '23:59:59', '3D',
            130000.00, 1.200, 2.000, 1.000, 100),
        ('IMAX weekday', 'WEEKDAY', TIME '08:00', TIME '23:59:59', 'IMAX',
            150000.00, 1.200, 2.000, 1.000, 110),
        ('IMAX weekend', 'WEEKEND', TIME '08:00', TIME '23:59:59', 'IMAX',
            180000.00, 1.200, 2.000, 1.000, 110),
        ('4DX weekday', 'WEEKDAY', TIME '08:00', TIME '23:59:59', '4DX',
            160000.00, 1.200, 2.000, 1.000, 110),
        ('4DX weekend', 'WEEKEND', TIME '08:00', TIME '23:59:59', '4DX',
            190000.00, 1.200, 2.000, 1.000, 110),
        ('ScreenX weekday', 'WEEKDAY', TIME '08:00', TIME '23:59:59', 'SCREENX',
            130000.00, 1.200, 2.000, 1.000, 105),
        ('ScreenX weekend', 'WEEKEND', TIME '08:00', TIME '23:59:59', 'SCREENX',
            150000.00, 1.200, 2.000, 1.000, 105)
)
INSERT INTO price_rate (
    price_book_id, name, day_type, start_time, end_time, format_id,
    standard_price, vip_multiplier, couple_multiplier,
    accessible_multiplier, priority, active
)
SELECT
    target_book.price_book_id,
    rate_input.name,
    rate_input.day_type,
    rate_input.start_time,
    rate_input.end_time,
    screening_format.format_id,
    rate_input.standard_price,
    rate_input.vip_multiplier,
    rate_input.couple_multiplier,
    rate_input.accessible_multiplier,
    rate_input.priority,
    TRUE
FROM target_book
CROSS JOIN rate_input
LEFT JOIN screening_format
    ON screening_format.format_code = rate_input.format_code;

COMMIT;
