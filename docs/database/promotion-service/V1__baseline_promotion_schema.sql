-- Promotion service baseline schema.
--
-- This service owns promotion definitions, their controlled pricing rules and
-- the reservation/usage lifecycle. Movie, showtime, booking and account IDs
-- are logical cross-service references, so they deliberately have no foreign
-- keys to databases owned by other services.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION normalize_promotion_code()
RETURNS TRIGGER AS $$
BEGIN
    NEW.code := UPPER(BTRIM(NEW.code));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_promotion_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE promotion (
    promotion_id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code                        VARCHAR(64)  NOT NULL UNIQUE,
    name                        VARCHAR(160) NOT NULL,
    description                 TEXT,
    status                      VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    valid_from                  TIMESTAMPTZ,
    valid_until                 TIMESTAMPTZ,
    global_usage_limit          INTEGER,
    per_account_usage_limit     INTEGER,
    active_reservation_count    INTEGER      NOT NULL DEFAULT 0,
    committed_usage_count       INTEGER      NOT NULL DEFAULT 0,
    version                     BIGINT       NOT NULL DEFAULT 0,
    created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_promotion_code_normalized
        CHECK (code = UPPER(BTRIM(code)) AND CHAR_LENGTH(code) > 0),
    CONSTRAINT chk_promotion_status
        CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED')),
    CONSTRAINT chk_promotion_validity_window
        CHECK (valid_from IS NULL OR valid_until IS NULL OR valid_from < valid_until),
    CONSTRAINT chk_promotion_global_usage_limit
        CHECK (global_usage_limit IS NULL OR global_usage_limit > 0),
    CONSTRAINT chk_promotion_per_account_usage_limit
        CHECK (per_account_usage_limit IS NULL OR per_account_usage_limit > 0),
    CONSTRAINT chk_promotion_usage_counts
        CHECK (active_reservation_count >= 0 AND committed_usage_count >= 0),
    CONSTRAINT chk_promotion_usage_not_over_limit
        CHECK (
            global_usage_limit IS NULL
            OR active_reservation_count + committed_usage_count <= global_usage_limit
        ),
    CONSTRAINT chk_promotion_version
        CHECK (version >= 0)
);

CREATE TRIGGER trg_promotion_normalize_code
    BEFORE INSERT OR UPDATE OF code ON promotion
    FOR EACH ROW EXECUTE FUNCTION normalize_promotion_code();

CREATE TRIGGER trg_promotion_updated_at
    BEFORE UPDATE ON promotion
    FOR EACH ROW EXECUTE FUNCTION set_promotion_updated_at();

CREATE INDEX idx_promotion_active_window
    ON promotion (status, valid_from, valid_until)
    WHERE status = 'ACTIVE';

CREATE TABLE promotion_target (
    promotion_target_id UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    promotion_id        UUID        NOT NULL REFERENCES promotion(promotion_id) ON DELETE CASCADE,
    target_type         VARCHAR(20) NOT NULL,
    movie_id            BIGINT,
    showtime_id         BIGINT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_promotion_target_type
        CHECK (target_type IN ('MOVIE', 'SHOWTIME')),
    CONSTRAINT chk_promotion_target_reference
        CHECK (
            (target_type = 'MOVIE' AND movie_id IS NOT NULL AND showtime_id IS NULL)
            OR (target_type = 'SHOWTIME' AND showtime_id IS NOT NULL AND movie_id IS NULL)
        )
);

CREATE UNIQUE INDEX uq_promotion_target_movie
    ON promotion_target (promotion_id, movie_id)
    WHERE movie_id IS NOT NULL;

CREATE UNIQUE INDEX uq_promotion_target_showtime
    ON promotion_target (promotion_id, showtime_id)
    WHERE showtime_id IS NOT NULL;

CREATE INDEX idx_promotion_target_movie
    ON promotion_target (movie_id)
    WHERE movie_id IS NOT NULL;

CREATE INDEX idx_promotion_target_showtime
    ON promotion_target (showtime_id)
    WHERE showtime_id IS NOT NULL;

CREATE TABLE promotion_price_rule (
    promotion_price_rule_id UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    promotion_id            UUID          NOT NULL UNIQUE REFERENCES promotion(promotion_id) ON DELETE CASCADE,
    discount_type           VARCHAR(20)   NOT NULL,
    percentage              NUMERIC(5, 2),
    fixed_amount            NUMERIC(14, 2),
    max_discount_amount     NUMERIC(14, 2),
    minimum_order_amount    NUMERIC(14, 2) NOT NULL DEFAULT 0,
    currency                CHAR(3)       NOT NULL DEFAULT 'VND',
    created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_price_rule_discount_type
        CHECK (discount_type IN ('PERCENTAGE', 'FIXED_AMOUNT')),
    CONSTRAINT chk_price_rule_amount_shape
        CHECK (
            (discount_type = 'PERCENTAGE'
                AND percentage IS NOT NULL AND percentage > 0 AND percentage <= 100
                AND fixed_amount IS NULL)
            OR (discount_type = 'FIXED_AMOUNT'
                AND fixed_amount IS NOT NULL AND fixed_amount > 0
                AND percentage IS NULL AND max_discount_amount IS NULL)
        ),
    CONSTRAINT chk_price_rule_max_discount
        CHECK (max_discount_amount IS NULL OR max_discount_amount > 0),
    CONSTRAINT chk_price_rule_minimum_order
        CHECK (minimum_order_amount >= 0),
    CONSTRAINT chk_price_rule_currency
        CHECK (currency = UPPER(currency) AND currency ~ '^[A-Z]{3}$')
);

CREATE TRIGGER trg_promotion_price_rule_updated_at
    BEFORE UPDATE ON promotion_price_rule
    FOR EACH ROW EXECUTE FUNCTION set_promotion_updated_at();

CREATE TABLE promotion_reservation (
    promotion_reservation_id UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    promotion_id             UUID          NOT NULL REFERENCES promotion(promotion_id) ON DELETE RESTRICT,
    booking_id               VARCHAR(50)   NOT NULL,
    account_id               VARCHAR(50)   NOT NULL,
    idempotency_key          VARCHAR(128)  NOT NULL UNIQUE,
    status                   VARCHAR(20)   NOT NULL DEFAULT 'RESERVED',
    subtotal_amount          NUMERIC(14, 2) NOT NULL,
    discount_amount          NUMERIC(14, 2) NOT NULL,
    final_amount             NUMERIC(14, 2) NOT NULL,
    currency                 CHAR(3)       NOT NULL DEFAULT 'VND',
    reserved_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    expires_at               TIMESTAMPTZ   NOT NULL,
    committed_at             TIMESTAMPTZ,
    released_at              TIMESTAMPTZ,
    expired_at               TIMESTAMPTZ,
    version                  BIGINT        NOT NULL DEFAULT 0,
    created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_promotion_reservation_status
        CHECK (status IN ('RESERVED', 'COMMITTED', 'RELEASED', 'EXPIRED')),
    CONSTRAINT chk_promotion_reservation_idempotency_key
        CHECK (idempotency_key = BTRIM(idempotency_key) AND CHAR_LENGTH(idempotency_key) > 0),
    CONSTRAINT chk_promotion_reservation_amounts
        CHECK (
            subtotal_amount >= 0
            AND discount_amount >= 0
            AND discount_amount <= subtotal_amount
            AND final_amount = subtotal_amount - discount_amount
        ),
    CONSTRAINT chk_promotion_reservation_currency
        CHECK (currency = UPPER(currency) AND currency ~ '^[A-Z]{3}$'),
    CONSTRAINT chk_promotion_reservation_expiry
        CHECK (expires_at > reserved_at),
    CONSTRAINT chk_promotion_reservation_lifecycle_timestamps
        CHECK (
            (status = 'RESERVED' AND committed_at IS NULL AND released_at IS NULL AND expired_at IS NULL)
            OR (status = 'COMMITTED' AND committed_at IS NOT NULL AND released_at IS NULL AND expired_at IS NULL)
            OR (status = 'RELEASED' AND committed_at IS NULL AND released_at IS NOT NULL AND expired_at IS NULL)
            OR (status = 'EXPIRED' AND committed_at IS NULL AND released_at IS NULL AND expired_at IS NOT NULL)
        ),
    CONSTRAINT chk_promotion_reservation_version
        CHECK (version >= 0)
);

CREATE TRIGGER trg_promotion_reservation_updated_at
    BEFORE UPDATE ON promotion_reservation
    FOR EACH ROW EXECUTE FUNCTION set_promotion_updated_at();

CREATE OR REPLACE FUNCTION prevent_promotion_reservation_snapshot_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.subtotal_amount IS DISTINCT FROM NEW.subtotal_amount
       OR OLD.discount_amount IS DISTINCT FROM NEW.discount_amount
       OR OLD.final_amount IS DISTINCT FROM NEW.final_amount
       OR OLD.currency IS DISTINCT FROM NEW.currency THEN
        RAISE EXCEPTION 'promotion reservation money snapshot is immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_promotion_reservation_snapshot_immutable
    BEFORE UPDATE OF subtotal_amount, discount_amount, final_amount, currency ON promotion_reservation
    FOR EACH ROW EXECUTE FUNCTION prevent_promotion_reservation_snapshot_mutation();

CREATE INDEX idx_promotion_reservation_expiry
    ON promotion_reservation (expires_at)
    WHERE status = 'RESERVED';

CREATE INDEX idx_promotion_reservation_account_usage
    ON promotion_reservation (promotion_id, account_id, status);

CREATE INDEX idx_promotion_reservation_booking
    ON promotion_reservation (booking_id);

CREATE TABLE promotion_usage_ledger (
    promotion_usage_ledger_id UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    promotion_id              UUID          NOT NULL REFERENCES promotion(promotion_id) ON DELETE RESTRICT,
    promotion_reservation_id  UUID          NOT NULL REFERENCES promotion_reservation(promotion_reservation_id) ON DELETE RESTRICT,
    account_id                VARCHAR(50)   NOT NULL,
    booking_id                VARCHAR(50)   NOT NULL,
    event_type                VARCHAR(20)   NOT NULL,
    usage_delta               SMALLINT      NOT NULL,
    occurred_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_promotion_usage_ledger_event
        UNIQUE (promotion_reservation_id, event_type),
    CONSTRAINT chk_promotion_usage_ledger_event
        CHECK (event_type IN ('RESERVED', 'COMMITTED', 'RELEASED', 'EXPIRED')),
    CONSTRAINT chk_promotion_usage_ledger_delta
        CHECK (
            (event_type = 'RESERVED' AND usage_delta = 1)
            OR (event_type = 'COMMITTED' AND usage_delta = 0)
            OR (event_type IN ('RELEASED', 'EXPIRED') AND usage_delta = -1)
        )
);

CREATE INDEX idx_promotion_usage_ledger_promotion_account
    ON promotion_usage_ledger (promotion_id, account_id, occurred_at DESC);

CREATE INDEX idx_promotion_usage_ledger_booking
    ON promotion_usage_ledger (booking_id);

CREATE OR REPLACE FUNCTION prevent_promotion_usage_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'promotion_usage_ledger is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_promotion_usage_ledger_append_only
    BEFORE UPDATE OR DELETE ON promotion_usage_ledger
    FOR EACH ROW EXECUTE FUNCTION prevent_promotion_usage_ledger_mutation();

COMMENT ON TABLE promotion IS
    'Promotion definition. Empty promotion_target means the promotion is not restricted by movie or showtime.';
COMMENT ON TABLE promotion_target IS
    'One target per row; movie/showtime references are logical because movie-service owns them.';
COMMENT ON TABLE promotion_price_rule IS
    'The only source of discount configuration. Reservation values are calculated server-side snapshots.';
COMMENT ON TABLE promotion_reservation IS
    'Idempotent reserve/commit/release lifecycle with immutable money snapshots.';
COMMENT ON TABLE promotion_usage_ledger IS
    'Append-only audit ledger for quota changes. Reservation and promotion counters are updated in the same transaction.';
