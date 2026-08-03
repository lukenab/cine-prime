INSERT INTO concession_product (id, code, name, category, description, image_url, active, status, created_by) VALUES
    (1, 'POPCORN', 'Bắp rang', 'POPCORN', 'Bắp rang giòn, chế biến trong ngày.', 'https://images.unsplash.com/photo-1585647347483-22b66260dfff?auto=format&fit=crop&w=900&q=80', TRUE, 'ACTIVE', 'demo-seed'),
    (2, 'SOFT-DRINK', 'Nước ngọt', 'DRINKS', 'Nước ngọt có ga dùng lạnh.', 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=900&q=80', TRUE, 'ACTIVE', 'demo-seed'),
    (3, 'WATER', 'Nước suối', 'DRINKS', 'Nước suối tinh khiết 500 ml.', 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=900&q=80', TRUE, 'ACTIVE', 'demo-seed'),
    (4, 'NACHOS', 'Nachos', 'SNACKS', 'Bánh nachos giòn dùng kèm sốt phô mai.', 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?auto=format&fit=crop&w=900&q=80', TRUE, 'ACTIVE', 'demo-seed')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, category = EXCLUDED.category, description = EXCLUDED.description,
    image_url = EXCLUDED.image_url, active = EXCLUDED.active, status = EXCLUDED.status;

INSERT INTO concession_sku (id, product_id, sku_code, size, flavor, active) VALUES
    (1, 1, 'POP-CARAMEL-M', 'M', 'Caramel', TRUE),
    (2, 1, 'POP-CHEESE-L', 'L', 'Phô mai', TRUE),
    (3, 1, 'POP-SALTED-L', 'L', 'Truyền thống', TRUE),
    (4, 2, 'PEPSI-L', 'L', 'Pepsi', TRUE),
    (5, 2, '7UP-L', 'L', '7Up', TRUE),
    (6, 2, 'MIRINDA-L', 'L', 'Mirinda', TRUE),
    (7, 3, 'WATER-500', '500 ml', NULL, TRUE),
    (8, 4, 'NACHOS-CHEESE', 'Regular', 'Phô mai', TRUE)
ON CONFLICT (id) DO UPDATE SET
    product_id = EXCLUDED.product_id, sku_code = EXCLUDED.sku_code,
    size = EXCLUDED.size, flavor = EXCLUDED.flavor, active = EXCLUDED.active;

INSERT INTO concession_combo (id, code, name, description, image_url, active) VALUES
    (1, 'COMBO-COUPLE', 'Couple Combo', '1 bắp lớn và 2 nước lớn tùy chọn.', 'https://images.unsplash.com/photo-1578849278619-e73505e9610f?auto=format&fit=crop&w=900&q=80', TRUE)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description,
    image_url = EXCLUDED.image_url, active = EXCLUDED.active;

INSERT INTO concession_combo_component
    (combo_id, group_code, allowed_sku_id, quantity, min_select, max_select)
VALUES
    (1, 'POPCORN', 2, 1, 1, 1),
    (1, 'POPCORN', 3, 1, 1, 1),
    (1, 'DRINK', 4, 1, 2, 2),
    (1, 'DRINK', 5, 1, 2, 2),
    (1, 'DRINK', 6, 1, 2, 2)
ON CONFLICT (combo_id, group_code, allowed_sku_id) DO UPDATE SET
    quantity = EXCLUDED.quantity, min_select = EXCLUDED.min_select, max_select = EXCLUDED.max_select;

INSERT INTO cluster_concession_offer
    (cinema_cluster_id, sellable_type, sellable_id, price, currency, available)
SELECT cluster_id, sellable_type, sellable_id, price, 'VND', TRUE
FROM generate_series(1, 10) AS cluster_id
CROSS JOIN (VALUES
    ('SKU', 1, 59000.00), ('SKU', 2, 79000.00), ('SKU', 3, 69000.00),
    ('SKU', 4, 45000.00), ('SKU', 5, 45000.00), ('SKU', 6, 45000.00),
    ('SKU', 7, 25000.00), ('SKU', 8, 59000.00), ('COMBO', 1, 149000.00)
) AS offer(sellable_type, sellable_id, price)
ON CONFLICT (cinema_cluster_id, sellable_type, sellable_id) DO NOTHING;

INSERT INTO cluster_inventory (cinema_cluster_id, sku_id, on_hand, reserved)
SELECT cluster_id, sku_id, 100, 0
FROM generate_series(1, 10) AS cluster_id
CROSS JOIN generate_series(1, 8) AS sku_id
ON CONFLICT (cinema_cluster_id, sku_id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('concession_product', 'id'), GREATEST((SELECT MAX(id) FROM concession_product), 4), TRUE);
SELECT setval(pg_get_serial_sequence('concession_sku', 'id'), GREATEST((SELECT MAX(id) FROM concession_sku), 8), TRUE);
SELECT setval(pg_get_serial_sequence('concession_combo', 'id'), GREATEST((SELECT MAX(id) FROM concession_combo), 1), TRUE);
