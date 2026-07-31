CREATE TABLE concession_offer_audit (
    id BIGSERIAL PRIMARY KEY,
    cinema_cluster_id BIGINT NOT NULL,
    sellable_type VARCHAR(10) NOT NULL CHECK (sellable_type IN ('SKU', 'COMBO')),
    sellable_id BIGINT NOT NULL,
    operation VARCHAR(20) NOT NULL CHECK (operation IN ('CREATE', 'UPDATE', 'BULK_UPDATE', 'COPY')),
    old_price NUMERIC(15,2),
    new_price NUMERIC(15,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    old_available BOOLEAN,
    new_available BOOLEAN NOT NULL,
    old_effective_from TIMESTAMPTZ,
    new_effective_from TIMESTAMPTZ,
    old_effective_to TIMESTAMPTZ,
    new_effective_to TIMESTAMPTZ,
    source_cluster_id BIGINT,
    changed_by VARCHAR(150) NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_concession_offer_audit_cluster_time
    ON concession_offer_audit(cinema_cluster_id, changed_at DESC);

CREATE INDEX idx_concession_offer_audit_sellable
    ON concession_offer_audit(sellable_type, sellable_id, changed_at DESC);
