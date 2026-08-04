INSERT INTO promotion (
    code, name, description, status, valid_from, valid_until,
    global_usage_limit, per_account_usage_limit
) VALUES (
    'CINEPRIME20',
    'CinePrime Opening Offer',
    'Demo promotion: 20% off ticket subtotal, capped at 50,000 VND.',
    'ACTIVE',
    TIMESTAMPTZ '2026-01-01 00:00:00+07',
    TIMESTAMPTZ '2027-12-31 23:59:59+07',
    1000,
    5
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO promotion_price_rule (
    promotion_id, discount_type, percentage, max_discount_amount,
    minimum_order_amount, currency
)
SELECT promotion_id, 'PERCENTAGE', 20.00, 50000.00, 100000.00, 'VND'
FROM promotion
WHERE code = 'CINEPRIME20'
ON CONFLICT (promotion_id) DO NOTHING;
