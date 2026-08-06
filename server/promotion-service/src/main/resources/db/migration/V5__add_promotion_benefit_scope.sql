ALTER TABLE promotion
    ADD COLUMN IF NOT EXISTS benefit_scope VARCHAR(20) NOT NULL DEFAULT 'TICKETS';

ALTER TABLE promotion
    ADD CONSTRAINT chk_promotion_benefit_scope
        CHECK (benefit_scope IN ('TICKETS', 'CONCESSIONS', 'ORDER'));

ALTER TABLE promotion_reservation
    ADD COLUMN IF NOT EXISTS benefit_scope VARCHAR(20) NOT NULL DEFAULT 'TICKETS';

ALTER TABLE promotion_reservation
    ADD CONSTRAINT chk_promotion_reservation_benefit_scope
        CHECK (benefit_scope IN ('TICKETS', 'CONCESSIONS', 'ORDER'));

INSERT INTO promotion (
    promotion_id, code, name, description, status, benefit_scope,
    valid_from, valid_until, global_usage_limit, per_account_usage_limit
) VALUES (
    '7f48bc72-bb31-4ca3-93b5-8e34a30dc002', 'CINEPRIME10',
    'CinePrime complete order',
    '10% off the eligible ticket and concession subtotal for checkout demonstrations.',
    'ACTIVE', 'ORDER', NOW() - INTERVAL '1 day', NOW() + INTERVAL '365 days', 500, 5
) ON CONFLICT (code) DO NOTHING;

INSERT INTO promotion_price_rule (
    promotion_price_rule_id, promotion_id, discount_type, percentage,
    fixed_amount, max_discount_amount, minimum_order_amount, currency
) VALUES (
    '86168908-b70f-47b8-9698-b47c02024c02',
    '7f48bc72-bb31-4ca3-93b5-8e34a30dc002',
    'PERCENTAGE', 10, NULL, 70000, 150000, 'VND'
) ON CONFLICT (promotion_id) DO NOTHING;
