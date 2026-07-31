CREATE TABLE concession_product (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(30) NOT NULL,
    description VARCHAR(500),
    image_url VARCHAR(1000),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE concession_sku (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES concession_product(id),
    sku_code VARCHAR(80) NOT NULL UNIQUE,
    size VARCHAR(30),
    flavor VARCHAR(80),
    attributes_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE concession_combo (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    description VARCHAR(500),
    image_url VARCHAR(1000),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE concession_combo_component (
    id BIGSERIAL PRIMARY KEY,
    combo_id BIGINT NOT NULL REFERENCES concession_combo(id) ON DELETE CASCADE,
    group_code VARCHAR(50) NOT NULL,
    allowed_sku_id BIGINT NOT NULL REFERENCES concession_sku(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    min_select INTEGER NOT NULL CHECK (min_select >= 0),
    max_select INTEGER NOT NULL CHECK (max_select >= min_select),
    UNIQUE (combo_id, group_code, allowed_sku_id)
);

CREATE TABLE cluster_concession_offer (
    id BIGSERIAL PRIMARY KEY,
    cinema_cluster_id BIGINT NOT NULL,
    sellable_type VARCHAR(10) NOT NULL CHECK (sellable_type IN ('SKU', 'COMBO')),
    sellable_id BIGINT NOT NULL,
    price NUMERIC(15,2) NOT NULL CHECK (price >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'VND',
    available BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from TIMESTAMPTZ,
    effective_to TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (cinema_cluster_id, sellable_type, sellable_id)
);
CREATE INDEX idx_concession_offer_catalog
    ON cluster_concession_offer(cinema_cluster_id, available, sellable_type);

CREATE TABLE cluster_inventory (
    cinema_cluster_id BIGINT NOT NULL,
    sku_id BIGINT NOT NULL REFERENCES concession_sku(id),
    on_hand INTEGER NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
    reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0 AND reserved <= on_hand),
    version BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (cinema_cluster_id, sku_id)
);

CREATE TABLE concession_reservation (
    id VARCHAR(50) PRIMARY KEY,
    booking_id VARCHAR(50) NOT NULL,
    customer_id VARCHAR(50) NOT NULL,
    cinema_cluster_id BIGINT NOT NULL,
    status VARCHAR(30) NOT NULL CHECK (status IN ('RESERVED','CONFIRMED','RELEASED','EXPIRED')),
    expires_at TIMESTAMPTZ NOT NULL,
    idempotency_key VARCHAR(120) NOT NULL UNIQUE,
    request_hash VARCHAR(64) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'VND',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX uq_active_concession_booking
    ON concession_reservation(booking_id) WHERE status IN ('RESERVED','CONFIRMED');

CREATE TABLE concession_reservation_item (
    id BIGSERIAL PRIMARY KEY,
    reservation_id VARCHAR(50) NOT NULL REFERENCES concession_reservation(id) ON DELETE CASCADE,
    item_code_snapshot VARCHAR(80) NOT NULL,
    item_name_snapshot VARCHAR(200) NOT NULL,
    options_snapshot TEXT NOT NULL DEFAULT '',
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_snapshot NUMERIC(15,2) NOT NULL CHECK (unit_price_snapshot >= 0),
    discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    final_amount NUMERIC(15,2) NOT NULL CHECK (final_amount >= 0)
);

CREATE TABLE concession_reservation_stock (
    reservation_id VARCHAR(50) NOT NULL REFERENCES concession_reservation(id) ON DELETE CASCADE,
    sku_id BIGINT NOT NULL REFERENCES concession_sku(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (reservation_id, sku_id)
);

CREATE TABLE concession_order (
    id VARCHAR(50) PRIMARY KEY,
    reservation_id VARCHAR(50) NOT NULL UNIQUE REFERENCES concession_reservation(id),
    booking_id VARCHAR(50) NOT NULL UNIQUE,
    payment_id VARCHAR(100),
    cinema_cluster_id BIGINT NOT NULL,
    pickup_code VARCHAR(12) NOT NULL UNIQUE,
    status VARCHAR(30) NOT NULL CHECK (status IN (
        'PENDING_PAYMENT','PAID','PREPARING','READY','COLLECTED',
        'CANCELLED','REFUND_PENDING','REFUNDED')),
    currency VARCHAR(3) NOT NULL DEFAULT 'VND',
    paid_at TIMESTAMPTZ,
    ready_at TIMESTAMPTZ,
    collected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_concession_order_queue
    ON concession_order(cinema_cluster_id, status, paid_at);

CREATE TABLE concession_order_item (
    id BIGSERIAL PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL REFERENCES concession_order(id) ON DELETE CASCADE,
    item_code_snapshot VARCHAR(80) NOT NULL,
    item_name_snapshot VARCHAR(200) NOT NULL,
    options_snapshot TEXT NOT NULL DEFAULT '',
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(15,2) NOT NULL,
    discount_amount NUMERIC(15,2) NOT NULL,
    final_amount NUMERIC(15,2) NOT NULL
);
