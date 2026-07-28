CREATE TABLE booking (
    booking_id VARCHAR(50) PRIMARY KEY,
    booking_code VARCHAR(30) NOT NULL UNIQUE,
    booking_type VARCHAR(20) NOT NULL,
    account_id VARCHAR(50) NOT NULL,
    member_id VARCHAR(50),
    showtime_id BIGINT NOT NULL,
    movie_id BIGINT,
    movie_name VARCHAR(255) NOT NULL,
    cluster_id BIGINT,
    cluster_name VARCHAR(255) NOT NULL,
    cinema_room_id BIGINT,
    cinema_room_name VARCHAR(255) NOT NULL,
    show_date DATE NOT NULL,
    start_time TIME NOT NULL,
    showtime_timezone VARCHAR(50) NOT NULL,
    hold_reference VARCHAR(100) NOT NULL UNIQUE,
    total_amount NUMERIC(15,2) NOT NULL,
    discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    points_used INTEGER NOT NULL DEFAULT 0,
    points_discount NUMERIC(15,2) NOT NULL DEFAULT 0,
    final_amount NUMERIC(15,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'VND',
    booking_status VARCHAR(30) NOT NULL,
    payment_status VARCHAR(30) NOT NULL,
    payment_reference VARCHAR(100) UNIQUE,
    refund_status VARCHAR(30) NOT NULL,
    inventory_status VARCHAR(30) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ,
    created_by VARCHAR(50),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_booking_type CHECK (booking_type IN ('ONLINE','COUNTER')),
    CONSTRAINT ck_booking_status CHECK (booking_status IN ('PENDING_PAYMENT','CONFIRM_PENDING','CONFIRMED','CANCEL_REQUESTED','CANCELLED','EXPIRED')),
    CONSTRAINT ck_booking_payment_status CHECK (payment_status IN ('NOT_STARTED','PENDING','PROCESSING','SUCCEEDED','FAILED','UNKNOWN','CANCELLED')),
    CONSTRAINT ck_booking_refund_status CHECK (refund_status IN ('NOT_REQUESTED','PENDING','SUCCEEDED','FAILED','UNKNOWN')),
    CONSTRAINT ck_booking_inventory_status CHECK (inventory_status IN ('HELD','RELEASE_PENDING','RELEASED','CONFIRM_PENDING','SOLD','CANCEL_SALE_PENDING','CANCELLED')),
    CONSTRAINT ck_booking_amounts CHECK (
        total_amount >= 0 AND discount_amount >= 0 AND points_discount >= 0
        AND final_amount >= 0 AND final_amount <= total_amount
    )
);
CREATE INDEX idx_booking_owner_created ON booking(account_id, created_at);
CREATE INDEX idx_booking_showtime ON booking(showtime_id);
CREATE INDEX idx_booking_status_expires ON booking(booking_status, expires_at);
CREATE INDEX idx_booking_cluster_created ON booking(cluster_id, created_at);

CREATE TABLE booking_item (
    booking_item_id VARCHAR(50) PRIMARY KEY,
    booking_id VARCHAR(50) NOT NULL REFERENCES booking(booking_id) ON DELETE CASCADE,
    showtime_seat_id BIGINT NOT NULL,
    seat_code VARCHAR(20) NOT NULL,
    seat_type VARCHAR(50) NOT NULL,
    unit_price NUMERIC(15,2) NOT NULL,
    discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    points_redeemed INTEGER NOT NULL DEFAULT 0,
    final_price NUMERIC(15,2) NOT NULL,
    is_from_points BOOLEAN NOT NULL DEFAULT FALSE,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uk_booking_item_seat UNIQUE (booking_id, showtime_seat_id),
    CONSTRAINT ck_booking_item_amounts CHECK (
        unit_price >= 0 AND discount_amount >= 0 AND final_price >= 0
    )
);
CREATE INDEX idx_booking_item_booking ON booking_item(booking_id);
CREATE INDEX idx_booking_item_showtime_seat ON booking_item(showtime_seat_id);

CREATE TABLE inventory_reservation (
    inventory_reservation_id VARCHAR(50) PRIMARY KEY,
    booking_id VARCHAR(50) NOT NULL UNIQUE REFERENCES booking(booking_id) ON DELETE CASCADE,
    hold_reference VARCHAR(100) NOT NULL UNIQUE,
    hold_token VARCHAR(512) NOT NULL UNIQUE,
    inventory_status VARCHAR(30) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    confirmed_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_inventory_reservation_status CHECK (inventory_status IN ('HELD','RELEASE_PENDING','RELEASED','CONFIRM_PENDING','SOLD','CANCEL_SALE_PENDING','CANCELLED'))
);
CREATE INDEX idx_inventory_status_expiry ON inventory_reservation(inventory_status, expires_at);

CREATE TABLE booking_refund (
    refund_id VARCHAR(50) PRIMARY KEY,
    booking_id VARCHAR(50) NOT NULL REFERENCES booking(booking_id),
    payment_reference VARCHAR(100) NOT NULL,
    refund_reference VARCHAR(100) UNIQUE,
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    amount NUMERIC(15,2) NOT NULL,
    cash_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    points_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    promotion_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    concession_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL,
    reason_code VARCHAR(100) NOT NULL,
    reason VARCHAR(500),
    refund_status VARCHAR(30) NOT NULL,
    completed_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_refund_status CHECK (refund_status IN ('NOT_REQUESTED','PENDING','SUCCEEDED','FAILED','UNKNOWN')),
    CONSTRAINT ck_refund_amounts CHECK (
        amount >= 0 AND cash_amount >= 0 AND points_amount >= 0
        AND promotion_amount >= 0 AND concession_amount >= 0
    )
);
CREATE INDEX idx_refund_booking ON booking_refund(booking_id);
CREATE INDEX idx_refund_status_created ON booking_refund(refund_status, created_at);

CREATE TABLE booking_cancellation (
    cancellation_id VARCHAR(50) PRIMARY KEY,
    booking_id VARCHAR(50) NOT NULL REFERENCES booking(booking_id),
    refund_id VARCHAR(50) UNIQUE REFERENCES booking_refund(refund_id),
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    request_hash VARCHAR(128) NOT NULL,
    source VARCHAR(40) NOT NULL,
    reason_code VARCHAR(100) NOT NULL,
    reason VARCHAR(500),
    actor_id VARCHAR(50) NOT NULL,
    correlation_id VARCHAR(100) NOT NULL,
    cancellation_status VARCHAR(30) NOT NULL,
    before_snapshot TEXT,
    after_snapshot TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_cancellation_status CHECK (cancellation_status IN ('REQUESTED','PROCESSING','COMPLETED','FAILED','MANUAL_REVIEW'))
);
CREATE INDEX idx_cancellation_booking ON booking_cancellation(booking_id);
CREATE INDEX idx_cancellation_status_created ON booking_cancellation(cancellation_status, requested_at);
CREATE UNIQUE INDEX uk_active_cancellation_per_booking
    ON booking_cancellation(booking_id)
    WHERE cancellation_status IN ('REQUESTED','PROCESSING','MANUAL_REVIEW');

CREATE TABLE ticket (
    ticket_id VARCHAR(50) PRIMARY KEY,
    booking_id VARCHAR(50) NOT NULL REFERENCES booking(booking_id) ON DELETE CASCADE,
    booking_item_id VARCHAR(50) NOT NULL UNIQUE REFERENCES booking_item(booking_item_id),
    account_id VARCHAR(50) NOT NULL,
    showtime_id BIGINT NOT NULL,
    movie_name VARCHAR(255) NOT NULL,
    cluster_id BIGINT,
    cluster_name VARCHAR(255) NOT NULL,
    cinema_room_name VARCHAR(255) NOT NULL,
    seat_code VARCHAR(20) NOT NULL,
    seat_type VARCHAR(50) NOT NULL,
    price NUMERIC(15,2) NOT NULL,
    ticket_status VARCHAR(20) NOT NULL,
    checked_in_at TIMESTAMPTZ,
    issued_by VARCHAR(50),
    version BIGINT NOT NULL DEFAULT 0,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_ticket_status CHECK (ticket_status IN ('VALID','USED','CANCELLED'))
);
CREATE INDEX idx_ticket_booking ON ticket(booking_id);
CREATE INDEX idx_ticket_owner_status ON ticket(account_id, ticket_status);

CREATE TABLE booking_ticket_pass (
    ticket_pass_id VARCHAR(50) PRIMARY KEY,
    booking_id VARCHAR(50) NOT NULL UNIQUE REFERENCES booking(booking_id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    token_ciphertext TEXT NOT NULL,
    key_version VARCHAR(50) NOT NULL,
    pass_status VARCHAR(20) NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoked_reason VARCHAR(255),
    version BIGINT NOT NULL DEFAULT 0,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_ticket_pass_status CHECK (pass_status IN ('ACTIVE','REVOKED'))
);
CREATE INDEX idx_ticket_pass_token_hash ON booking_ticket_pass(token_hash);

CREATE TABLE ticket_check_in (
    check_in_id VARCHAR(50) PRIMARY KEY,
    ticket_id VARCHAR(50) NOT NULL REFERENCES ticket(ticket_id),
    caller_scope VARCHAR(100) NOT NULL,
    idempotency_key VARCHAR(100) NOT NULL,
    request_hash VARCHAR(128) NOT NULL,
    check_in_mode VARCHAR(20) NOT NULL,
    gate_id VARCHAR(50) NOT NULL,
    checked_by VARCHAR(50) NOT NULL,
    device_id VARCHAR(100),
    result VARCHAR(30) NOT NULL,
    checked_in_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_check_in_scope_key UNIQUE (caller_scope, idempotency_key)
);
CREATE INDEX idx_check_in_ticket_time ON ticket_check_in(ticket_id, checked_in_at);

CREATE TABLE booking_operation (
    operation_id VARCHAR(50) PRIMARY KEY,
    caller_scope VARCHAR(100) NOT NULL,
    operation_name VARCHAR(100) NOT NULL,
    idempotency_key VARCHAR(100) NOT NULL,
    request_hash VARCHAR(128) NOT NULL,
    booking_id VARCHAR(50) REFERENCES booking(booking_id),
    operation_status VARCHAR(30) NOT NULL,
    http_status INTEGER,
    response_snapshot TEXT,
    poll_reference VARCHAR(100),
    correlation_id VARCHAR(100) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_operation_caller_name_key UNIQUE (caller_scope, operation_name, idempotency_key),
    CONSTRAINT ck_operation_status CHECK (operation_status IN ('IN_PROGRESS','SUCCEEDED','FAILED_RETRYABLE','FAILED_TERMINAL'))
);
CREATE INDEX idx_operation_status_expiry ON booking_operation(operation_status, expires_at);

CREATE TABLE payment_event_inbox (
    inbox_id VARCHAR(50) PRIMARY KEY,
    event_source VARCHAR(50) NOT NULL,
    provider_event_id VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_version VARCHAR(20) NOT NULL,
    booking_id VARCHAR(50) REFERENCES booking(booking_id),
    payment_reference VARCHAR(100),
    amount NUMERIC(15,2),
    currency VARCHAR(3),
    correlation_id VARCHAR(100) NOT NULL,
    payload TEXT NOT NULL,
    processing_status VARCHAR(30) NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMPTZ,
    next_attempt_at TIMESTAMPTZ,
    last_error TEXT,
    CONSTRAINT uk_inbox_event UNIQUE (event_source, provider_event_id)
);
CREATE INDEX idx_inbox_status_received ON payment_event_inbox(processing_status, received_at);

CREATE TABLE compensation_task (
    task_id VARCHAR(50) PRIMARY KEY,
    booking_id VARCHAR(50) REFERENCES booking(booking_id),
    operation_name VARCHAR(100) NOT NULL,
    target_service VARCHAR(100) NOT NULL,
    target_reference VARCHAR(255) NOT NULL,
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    task_status VARCHAR(30) NOT NULL,
    command_payload TEXT NOT NULL,
    correlation_id VARCHAR(100) NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ,
    claimed_by VARCHAR(100),
    claim_until TIMESTAMPTZ,
    last_error TEXT,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_compensation_claim ON compensation_task(task_status, next_attempt_at);
CREATE INDEX idx_compensation_booking ON compensation_task(booking_id);

CREATE TABLE outbox_event (
    event_id VARCHAR(50) PRIMARY KEY,
    booking_id VARCHAR(50) REFERENCES booking(booking_id),
    aggregate_type VARCHAR(50) NOT NULL,
    aggregate_id VARCHAR(50) NOT NULL,
    aggregate_version BIGINT NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    schema_version VARCHAR(20) NOT NULL,
    correlation_id VARCHAR(100) NOT NULL,
    causation_id VARCHAR(100),
    partition_key VARCHAR(100) NOT NULL,
    payload TEXT NOT NULL,
    publish_status VARCHAR(30) NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMPTZ,
    last_error TEXT
);
CREATE INDEX idx_outbox_claim ON outbox_event(publish_status, next_attempt_at);
CREATE INDEX idx_outbox_aggregate ON outbox_event(aggregate_type, aggregate_id);

CREATE TABLE booking_reconciliation (
    reconciliation_id VARCHAR(50) PRIMARY KEY,
    booking_id VARCHAR(50) REFERENCES booking(booking_id),
    case_type VARCHAR(100) NOT NULL,
    severity VARCHAR(30) NOT NULL,
    reconciliation_status VARCHAR(30) NOT NULL,
    payment_reference VARCHAR(100),
    hold_reference VARCHAR(100),
    cluster_id BIGINT,
    evidence TEXT NOT NULL,
    owner_id VARCHAR(50),
    created_by VARCHAR(50) NOT NULL,
    correlation_id VARCHAR(100) NOT NULL,
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_reconciliation_status CHECK (reconciliation_status IN ('OPEN','IN_PROGRESS','RESOLVED','MANUAL_REVIEW','CLOSED'))
);
CREATE INDEX idx_reconciliation_status_severity ON booking_reconciliation(reconciliation_status, severity);
CREATE INDEX idx_reconciliation_booking ON booking_reconciliation(booking_id);

CREATE TABLE booking_reconciliation_attempt (
    attempt_id VARCHAR(50) PRIMARY KEY,
    reconciliation_id VARCHAR(50) NOT NULL REFERENCES booking_reconciliation(reconciliation_id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,
    attempt_status VARCHAR(30) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    requested_by VARCHAR(50) NOT NULL,
    before_snapshot TEXT,
    after_snapshot TEXT,
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_reconciliation_attempt_case ON booking_reconciliation_attempt(reconciliation_id, created_at);

CREATE TABLE counter_payment (
    counter_payment_id VARCHAR(50) PRIMARY KEY,
    booking_id VARCHAR(50) NOT NULL UNIQUE REFERENCES booking(booking_id),
    payment_reference VARCHAR(100) NOT NULL UNIQUE,
    receipt_reference VARCHAR(100) NOT NULL UNIQUE,
    cashier_id VARCHAR(50) NOT NULL,
    terminal_id VARCHAR(50) NOT NULL,
    cluster_id BIGINT NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    collected_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_counter_payment_amount CHECK (amount >= 0)
);
CREATE INDEX idx_counter_payment_booking ON counter_payment(booking_id);

CREATE TABLE booking_quote (
    quote_id VARCHAR(50) PRIMARY KEY,
    account_id VARCHAR(50) NOT NULL,
    showtime_id BIGINT NOT NULL,
    subtotal NUMERIC(15,2) NOT NULL,
    discount_amount NUMERIC(15,2) NOT NULL,
    fee_amount NUMERIC(15,2) NOT NULL,
    final_amount NUMERIC(15,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    quote_status VARCHAR(30) NOT NULL,
    request_hash VARCHAR(128) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_quote_amounts CHECK (
        subtotal >= 0 AND discount_amount >= 0 AND fee_amount >= 0 AND final_amount >= 0
    )
);
CREATE INDEX idx_quote_owner_expiry ON booking_quote(account_id, expires_at);

CREATE TABLE booking_quote_item (
    quote_item_id VARCHAR(50) PRIMARY KEY,
    quote_id VARCHAR(50) NOT NULL REFERENCES booking_quote(quote_id) ON DELETE CASCADE,
    item_type VARCHAR(30) NOT NULL,
    external_item_id VARCHAR(100) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(15,2) NOT NULL,
    discount_amount NUMERIC(15,2) NOT NULL,
    final_amount NUMERIC(15,2) NOT NULL,
    CONSTRAINT ck_quote_item_values CHECK (
        quantity > 0 AND unit_price >= 0 AND discount_amount >= 0 AND final_amount >= 0
    )
);
CREATE INDEX idx_quote_item_quote ON booking_quote_item(quote_id);

CREATE TABLE promotion_reservation (
    promotion_reservation_id VARCHAR(50) PRIMARY KEY,
    booking_id VARCHAR(50) NOT NULL REFERENCES booking(booking_id),
    promotion_id VARCHAR(100) NOT NULL,
    promotion_code VARCHAR(100),
    external_reservation_id VARCHAR(100) NOT NULL UNIQUE,
    discount_amount NUMERIC(15,2) NOT NULL,
    reservation_status VARCHAR(30) NOT NULL,
    expires_at TIMESTAMPTZ,
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_promotion_booking ON promotion_reservation(booking_id);

CREATE TABLE loyalty_reservation (
    loyalty_reservation_id VARCHAR(50) PRIMARY KEY,
    booking_id VARCHAR(50) NOT NULL UNIQUE REFERENCES booking(booking_id),
    external_reservation_id VARCHAR(100) NOT NULL UNIQUE,
    points_reserved INTEGER NOT NULL,
    discount_amount NUMERIC(15,2) NOT NULL,
    reservation_status VARCHAR(30) NOT NULL,
    expires_at TIMESTAMPTZ,
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_loyalty_values CHECK (points_reserved >= 0 AND discount_amount >= 0)
);
CREATE INDEX idx_loyalty_booking ON loyalty_reservation(booking_id);

CREATE TABLE booking_concession_item (
    concession_item_id VARCHAR(50) PRIMARY KEY,
    booking_id VARCHAR(50) NOT NULL REFERENCES booking(booking_id),
    sku VARCHAR(100) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(15,2) NOT NULL,
    discount_amount NUMERIC(15,2) NOT NULL,
    final_amount NUMERIC(15,2) NOT NULL,
    fulfillment_cluster_id BIGINT NOT NULL,
    external_reservation_id VARCHAR(100),
    reservation_status VARCHAR(30) NOT NULL,
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_concession_values CHECK (
        quantity > 0 AND unit_price >= 0 AND discount_amount >= 0 AND final_amount >= 0
    )
);
CREATE INDEX idx_concession_booking ON booking_concession_item(booking_id);

CREATE TABLE booking_audit_log (
    audit_id VARCHAR(50) PRIMARY KEY,
    booking_id VARCHAR(50) REFERENCES booking(booking_id),
    action VARCHAR(100) NOT NULL,
    actor_id VARCHAR(50) NOT NULL,
    actor_type VARCHAR(30) NOT NULL,
    reason VARCHAR(500),
    before_snapshot TEXT,
    after_snapshot TEXT,
    correlation_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_booking_audit_booking ON booking_audit_log(booking_id, created_at);
CREATE INDEX idx_booking_audit_correlation ON booking_audit_log(correlation_id);
