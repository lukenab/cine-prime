-- A compact demo catalogue that exercises every supported benefit scope and
-- both discount types. Minimum spend is evaluated against the eligible scope,
-- not against service fees.

INSERT INTO promotion (
    code, name, description, status, benefit_scope,
    valid_from, valid_until, global_usage_limit, per_account_usage_limit
) VALUES
    (
        'TICKET20K',
        'Ticket Saver 20K',
        '20,000 VND off eligible movie tickets from 100,000 VND.',
        'ACTIVE', 'TICKETS',
        NOW() - INTERVAL '1 day', NOW() + INTERVAL '365 days', 500, 5
    ),
    (
        'SNACK20',
        'CinePrime Snack Deal',
        '20% off eligible concessions from 70,000 VND, capped at 40,000 VND.',
        'ACTIVE', 'CONCESSIONS',
        NOW() - INTERVAL '1 day', NOW() + INTERVAL '365 days', 500, 5
    ),
    (
        'ORDER30K',
        'Complete Order Saver 30K',
        '30,000 VND off eligible tickets and concessions from 200,000 VND.',
        'ACTIVE', 'ORDER',
        NOW() - INTERVAL '1 day', NOW() + INTERVAL '365 days', 500, 5
    )
ON CONFLICT (code) DO NOTHING;

INSERT INTO promotion_price_rule (
    promotion_id, discount_type, percentage, fixed_amount,
    max_discount_amount, minimum_order_amount, currency
)
SELECT promotion_id, 'FIXED_AMOUNT', NULL, 20000, NULL, 100000, 'VND'
FROM promotion
WHERE code = 'TICKET20K'
ON CONFLICT (promotion_id) DO NOTHING;

INSERT INTO promotion_price_rule (
    promotion_id, discount_type, percentage, fixed_amount,
    max_discount_amount, minimum_order_amount, currency
)
SELECT promotion_id, 'PERCENTAGE', 20, NULL, 40000, 70000, 'VND'
FROM promotion
WHERE code = 'SNACK20'
ON CONFLICT (promotion_id) DO NOTHING;

INSERT INTO promotion_price_rule (
    promotion_id, discount_type, percentage, fixed_amount,
    max_discount_amount, minimum_order_amount, currency
)
SELECT promotion_id, 'FIXED_AMOUNT', NULL, 30000, NULL, 200000, 'VND'
FROM promotion
WHERE code = 'ORDER30K'
ON CONFLICT (promotion_id) DO NOTHING;
