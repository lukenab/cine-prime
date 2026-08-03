-- Deterministic CinePrime concession catalog for local/demo environments.
-- CinePrime Landmark 81 is cluster_id 43 (cluster code CP-023 in movie-service).

INSERT INTO concession_product
    (id, code, name, category, description, image_url, active, status, created_by)
VALUES
    (1, 'POPCORN', 'Bắp rang CinePrime', 'POPCORN',
        'Bắp rang giòn, chế biến trong ngày với ba lựa chọn vị.',
        '/images/concessions/product-popcorn.png', TRUE, 'ACTIVE', 'demo-seed'),
    (2, 'SOFT-DRINK', 'Nước ngọt', 'DRINKS',
        'Nước ngọt có ga dùng lạnh, ly lớn.',
        '/images/concessions/product-soft-drink.png', TRUE, 'ACTIVE', 'demo-seed'),
    (3, 'WATER', 'Nước suối', 'DRINKS',
        'Nước suối tinh khiết 500 ml.',
        '/images/concessions/product-water.png',
        TRUE, 'ACTIVE', 'demo-seed'),
    (4, 'NACHOS', 'Nachos phô mai', 'SNACKS',
        'Nachos giòn dùng kèm sốt phô mai.',
        '/images/concessions/product-nachos.png', TRUE, 'ACTIVE', 'demo-seed'),
    (5, 'HOT-DOG', 'Hot dog CinePrime', 'SNACKS',
        'Hot dog nóng với lựa chọn truyền thống hoặc phô mai.',
        '/images/concessions/product-hot-dog.png', TRUE, 'ACTIVE', 'demo-seed'),
    (6, 'POTATO-CHIPS', 'Khoai tây lát', 'SNACKS',
        'Khoai tây lát vị muối biển, gói nhỏ.',
        '/images/concessions/product-potato-chips.png', TRUE, 'ACTIVE', 'demo-seed'),
    (7, 'ORANGE-JUICE', 'Nước cam', 'DRINKS',
        'Nước cam mát lạnh, ly vừa.',
        '/images/concessions/product-orange-juice.png', TRUE, 'ACTIVE', 'demo-seed')
ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    image_url = EXCLUDED.image_url,
    active = EXCLUDED.active,
    status = EXCLUDED.status;

INSERT INTO concession_sku
    (id, product_id, sku_code, size, flavor, attributes_json, active)
VALUES
    (1, 1, 'POP-CARAMEL-M', 'M', 'Caramel', '{"serving":"1 person"}'::jsonb, TRUE),
    (2, 1, 'POP-CHEESE-L', 'L', 'Phô mai', '{"serving":"2 people"}'::jsonb, TRUE),
    (3, 1, 'POP-SALTED-L', 'L', 'Truyền thống', '{"serving":"2 people"}'::jsonb, TRUE),
    (4, 2, 'PEPSI-L', 'L', 'Pepsi', '{"ice":"regular"}'::jsonb, TRUE),
    (5, 2, '7UP-L', 'L', '7Up', '{"ice":"regular"}'::jsonb, TRUE),
    (6, 2, 'MIRINDA-L', 'L', 'Mirinda', '{"ice":"regular"}'::jsonb, TRUE),
    (7, 3, 'WATER-500', '500 ml', NULL, '{}'::jsonb, TRUE),
    (8, 4, 'NACHOS-CHEESE', 'Regular', 'Phô mai', '{}'::jsonb, TRUE),
    (9, 5, 'HOTDOG-CLASSIC', 'Regular', 'Truyền thống', '{}'::jsonb, TRUE),
    (10, 5, 'HOTDOG-CHEESE', 'Regular', 'Phô mai', '{}'::jsonb, TRUE),
    (11, 6, 'CHIPS-SEA-SALT', 'Small', 'Muối biển', '{}'::jsonb, TRUE),
    (12, 7, 'ORANGE-JUICE-M', 'M', 'Cam', '{"ice":"regular"}'::jsonb, TRUE),
    (13, 1, 'POP-CARAMEL-L', 'L', 'Caramel', '{"serving":"2 people"}'::jsonb, TRUE)
ON CONFLICT (id) DO UPDATE SET
    product_id = EXCLUDED.product_id,
    sku_code = EXCLUDED.sku_code,
    size = EXCLUDED.size,
    flavor = EXCLUDED.flavor,
    attributes_json = EXCLUDED.attributes_json,
    active = EXCLUDED.active;

INSERT INTO concession_combo
    (id, code, name, description, image_url, active)
VALUES
    (1, 'COMBO-COUPLE', 'Couple Premiere',
        '1 bắp lớn tùy chọn và 2 nước ngọt lớn.',
        '/images/concessions/combo-couple-premiere.png', TRUE),
    (2, 'COMBO-SOLO-BLUE', 'Solo Blue',
        '1 bắp lớn tùy chọn và 1 nước ngọt lớn.',
        '/images/concessions/combo-solo-blue.png', TRUE),
    (3, 'COMBO-FAMILY-NIGHT', 'Family Movie Night',
        '2 bắp lớn, 4 nước ngọt lớn và 1 phần nachos phô mai.',
        '/images/concessions/combo-family-movie-night.png', TRUE),
    (4, 'COMBO-KIDS-STAR', 'Kids Star',
        '1 bắp caramel vừa, 1 nước cam vừa và 1 gói khoai tây lát.',
        '/images/concessions/combo-kids-star.png', TRUE),
    (5, 'COMBO-BLOCKBUSTER', 'Blockbuster Crunch',
        '1 nachos phô mai, 2 hot dog tùy chọn và 2 nước ngọt lớn.',
        '/images/concessions/combo-blockbuster-crunch.png', TRUE)
ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    image_url = EXCLUDED.image_url,
    active = EXCLUDED.active;

-- Rebuild only the five demo combo definitions so a checksum-triggered rerun
-- cannot leave obsolete component rows behind.
DELETE FROM concession_combo_component WHERE combo_id BETWEEN 1 AND 5;

INSERT INTO concession_combo_component
    (combo_id, group_code, allowed_sku_id, quantity, min_select, max_select)
VALUES
    -- Couple Premiere: choose one popcorn and two drinks (duplicates allowed).
    (1, 'POPCORN', 2, 1, 1, 1),
    (1, 'POPCORN', 3, 1, 1, 1),
    (1, 'POPCORN', 13, 1, 1, 1),
    (1, 'DRINK', 4, 1, 2, 2),
    (1, 'DRINK', 5, 1, 2, 2),
    (1, 'DRINK', 6, 1, 2, 2),

    -- Solo Blue: choose one popcorn and one drink.
    (2, 'POPCORN', 2, 1, 1, 1),
    (2, 'POPCORN', 3, 1, 1, 1),
    (2, 'POPCORN', 13, 1, 1, 1),
    (2, 'DRINK', 4, 1, 1, 1),
    (2, 'DRINK', 5, 1, 1, 1),
    (2, 'DRINK', 6, 1, 1, 1),

    -- Family Movie Night: two popcorns, four drinks and one fixed nachos.
    (3, 'POPCORN', 2, 1, 2, 2),
    (3, 'POPCORN', 3, 1, 2, 2),
    (3, 'POPCORN', 13, 1, 2, 2),
    (3, 'DRINK', 4, 1, 4, 4),
    (3, 'DRINK', 5, 1, 4, 4),
    (3, 'DRINK', 6, 1, 4, 4),
    (3, 'NACHOS', 8, 1, 1, 1),

    -- Kids Star: three fixed items.
    (4, 'POPCORN', 1, 1, 1, 1),
    (4, 'DRINK', 12, 1, 1, 1),
    (4, 'SNACK', 11, 1, 1, 1),

    -- Blockbuster Crunch: fixed nachos, two hot dogs and two drinks.
    (5, 'NACHOS', 8, 1, 1, 1),
    (5, 'HOTDOG', 9, 1, 2, 2),
    (5, 'HOTDOG', 10, 1, 2, 2),
    (5, 'DRINK', 4, 1, 2, 2),
    (5, 'DRINK', 5, 1, 2, 2),
    (5, 'DRINK', 6, 1, 2, 2);

-- Standalone-item and combo price book. Clusters 1-10 preserve the existing
-- local dataset; cluster 43 explicitly makes Landmark 81 demo-ready.
INSERT INTO cluster_concession_offer
    (cinema_cluster_id, sellable_type, sellable_id, price, currency, available)
SELECT cluster_id, sellable_type, sellable_id, price, 'VND', TRUE
FROM (
    SELECT generate_series(1, 10)::BIGINT AS cluster_id
    UNION ALL
    SELECT 43::BIGINT
) clusters
CROSS JOIN (VALUES
    ('SKU', 1::BIGINT, 49000.00),
    ('SKU', 2::BIGINT, 79000.00),
    ('SKU', 3::BIGINT, 69000.00),
    ('SKU', 4::BIGINT, 45000.00),
    ('SKU', 5::BIGINT, 45000.00),
    ('SKU', 6::BIGINT, 45000.00),
    ('SKU', 7::BIGINT, 25000.00),
    ('SKU', 8::BIGINT, 59000.00),
    ('SKU', 9::BIGINT, 49000.00),
    ('SKU', 10::BIGINT, 55000.00),
    ('SKU', 11::BIGINT, 29000.00),
    ('SKU', 12::BIGINT, 35000.00),
    ('SKU', 13::BIGINT, 75000.00),
    ('COMBO', 1::BIGINT, 149000.00),
    ('COMBO', 2::BIGINT, 109000.00),
    ('COMBO', 3::BIGINT, 299000.00),
    ('COMBO', 4::BIGINT, 89000.00),
    ('COMBO', 5::BIGINT, 229000.00)
) AS offer(sellable_type, sellable_id, price)
ON CONFLICT (cinema_cluster_id, sellable_type, sellable_id) DO UPDATE SET
    price = EXCLUDED.price,
    currency = EXCLUDED.currency,
    available = EXCLUDED.available,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO cluster_inventory (cinema_cluster_id, sku_id, on_hand, reserved)
SELECT cluster_id, sku_id, 100, 0
FROM (
    SELECT generate_series(1, 10)::BIGINT AS cluster_id
    UNION ALL
    SELECT 43::BIGINT
) clusters
CROSS JOIN generate_series(1, 13) AS sku_id
ON CONFLICT (cinema_cluster_id, sku_id) DO UPDATE SET
    on_hand = GREATEST(cluster_inventory.on_hand, EXCLUDED.on_hand, cluster_inventory.reserved),
    updated_at = CURRENT_TIMESTAMP;

SELECT setval(
    pg_get_serial_sequence('concession_product', 'id'),
    GREATEST((SELECT MAX(id) FROM concession_product), 7), TRUE);
SELECT setval(
    pg_get_serial_sequence('concession_sku', 'id'),
    GREATEST((SELECT MAX(id) FROM concession_sku), 13), TRUE);
SELECT setval(
    pg_get_serial_sequence('concession_combo', 'id'),
    GREATEST((SELECT MAX(id) FROM concession_combo), 5), TRUE);
