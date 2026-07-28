-- Booking Service startup seed data
-- Target: PostgreSQL / booking_db after Flyway migration V1__canonical_booking_schema.sql
-- Automatically executed by Flyway as a repeatable migration when Booking Service starts.
-- Manual run (PowerShell):
--   psql -h localhost -p 5433 -U postgres -d booking_db `
--     -f server/booking-service/src/main/resources/db/seed/R__booking_service_test_data.sql
--
-- DBeaver:
--   1. Open this whole file and select the booking_db connection.
--   2. Use "Execute SQL Script" for the entire file.
--   3. Do not run a highlighted/partial INSERT with "Execute SQL Statement";
--      PostgreSQL will report "syntax error at end of input" when a VALUES
--      list is cut before its closing "ON CONFLICT ...;".
--
-- The script covers every canonical booking-service table.
-- Flyway wraps this script in a transaction. IDs use the "seed-" prefix and
-- ON CONFLICT DO NOTHING makes startup seeding idempotent when Flyway re-runs
-- this repeatable migration after a checksum change.

SET LOCAL TIME ZONE 'Asia/Ho_Chi_Minh';

DO $$
BEGIN
    IF to_regclass('public.booking') IS NULL
       OR to_regclass('public.booking_item') IS NULL
       OR to_regclass('public.booking_audit_log') IS NULL THEN
        RAISE EXCEPTION
            'Booking schema is missing. Run Flyway migration V1__canonical_booking_schema.sql first.';
    END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 1. booking
-- Scenarios:
--   pending   : waiting for payment, seats still HELD
--   confirmed : paid online booking, one ticket USED and one VALID
--   expired   : payment window expired, inventory released
--   cancelled : paid booking cancelled and refunded
--   counter   : paid cash at cinema counter
-- ---------------------------------------------------------------------------
INSERT INTO booking (
    booking_id, booking_code, booking_type, account_id, member_id,
    showtime_id, movie_id, movie_name, cluster_id, cluster_name,
    cinema_room_id, cinema_room_name, show_date, start_time,
    showtime_timezone, hold_reference,
    total_amount, discount_amount, points_used, points_discount, final_amount,
    currency, booking_status, payment_status, payment_reference,
    refund_status, inventory_status, expires_at, paid_at, created_by,
    version, created_at, updated_at
) VALUES
(
    'seed-booking-pending', 'SEED-BK-0001', 'ONLINE',
    'seed-account-001', 'seed-member-001',
    1001, 101, 'Dòng Chảy Thời Gian', 1, 'CinePrime Quận 1',
    11, 'Phòng Standard 01', DATE '2030-08-01', TIME '09:00:00',
    'Asia/Ho_Chi_Minh', 'seed-hold-ref-pending',
    170000.00, 0.00, 0, 0.00, 170000.00,
    'VND', 'PENDING_PAYMENT', 'NOT_STARTED', NULL,
    'NOT_REQUESTED', 'HELD',
    TIMESTAMPTZ '2030-08-01 08:55:00+07', NULL, 'seed-account-001',
    0, TIMESTAMPTZ '2030-08-01 08:40:00+07', TIMESTAMPTZ '2030-08-01 08:40:00+07'
),
(
    'seed-booking-confirmed', 'SEED-BK-0002', 'ONLINE',
    'seed-account-001', 'seed-member-001',
    1002, 102, 'Avengers: Endgame', 1, 'CinePrime Quận 1',
    12, 'Phòng IMAX 02', DATE '2030-08-01', TIME '19:00:00',
    'Asia/Ho_Chi_Minh', 'seed-hold-ref-confirmed',
    335000.00, 35000.00, 200, 20000.00, 280000.00,
    'VND', 'CONFIRMED', 'SUCCEEDED', 'seed-payment-confirmed',
    'NOT_REQUESTED', 'SOLD',
    TIMESTAMPTZ '2030-08-01 18:00:00+07',
    TIMESTAMPTZ '2030-08-01 17:48:00+07', 'seed-account-001',
    1, TIMESTAMPTZ '2030-08-01 17:40:00+07', TIMESTAMPTZ '2030-08-01 18:45:00+07'
),
(
    'seed-booking-expired', 'SEED-BK-0003', 'ONLINE',
    'seed-account-002', 'seed-member-002',
    1003, 103, 'Hành Trình Cuối Cùng', 2, 'CinePrime Thủ Đức',
    21, 'Phòng Standard 01', DATE '2030-07-20', TIME '14:30:00',
    'Asia/Ho_Chi_Minh', 'seed-hold-ref-expired',
    85000.00, 0.00, 0, 0.00, 85000.00,
    'VND', 'EXPIRED', 'NOT_STARTED', NULL,
    'NOT_REQUESTED', 'RELEASED',
    TIMESTAMPTZ '2030-07-20 14:15:00+07', NULL, 'seed-account-002',
    1, TIMESTAMPTZ '2030-07-20 14:00:00+07', TIMESTAMPTZ '2030-07-20 14:15:01+07'
),
(
    'seed-booking-cancelled', 'SEED-BK-0004', 'ONLINE',
    'seed-account-003', 'seed-member-003',
    1004, 104, 'Biển Đêm', 2, 'CinePrime Thủ Đức',
    22, 'Phòng VIP 02', DATE '2030-08-02', TIME '20:00:00',
    'Asia/Ho_Chi_Minh', 'seed-hold-ref-cancelled',
    120000.00, 0.00, 0, 0.00, 120000.00,
    'VND', 'CANCELLED', 'SUCCEEDED', 'seed-payment-cancelled',
    'SUCCEEDED', 'CANCELLED',
    TIMESTAMPTZ '2030-08-02 19:00:00+07',
    TIMESTAMPTZ '2030-07-25 10:05:00+07', 'seed-account-003',
    3, TIMESTAMPTZ '2030-07-25 10:00:00+07', TIMESTAMPTZ '2030-07-26 09:10:00+07'
),
(
    'seed-booking-counter', 'SEED-BK-0005', 'COUNTER',
    'seed-counter-customer', NULL,
    1005, 105, 'Mật Mã Thành Phố', 1, 'CinePrime Quận 1',
    13, 'Phòng Large 03', DATE '2030-08-03', TIME '18:30:00',
    'Asia/Ho_Chi_Minh', 'seed-hold-ref-counter',
    85000.00, 0.00, 0, 0.00, 85000.00,
    'VND', 'CONFIRMED', 'SUCCEEDED', 'seed-counter-payment-ref',
    'NOT_REQUESTED', 'SOLD',
    TIMESTAMPTZ '2030-08-03 18:20:00+07',
    TIMESTAMPTZ '2030-08-03 18:05:00+07', 'seed-employee-001',
    1, TIMESTAMPTZ '2030-08-03 18:04:00+07', TIMESTAMPTZ '2030-08-03 18:05:00+07'
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. booking_item
-- ---------------------------------------------------------------------------
INSERT INTO booking_item (
    booking_item_id, booking_id, showtime_seat_id, seat_code, seat_type,
    unit_price, discount_amount, points_redeemed, final_price,
    is_from_points, version
) VALUES
('seed-item-pending-a1',   'seed-booking-pending',   10001, 'A1', 'STANDARD', 85000.00, 0.00, 0,   85000.00, FALSE, 0),
('seed-item-pending-a2',   'seed-booking-pending',   10002, 'A2', 'STANDARD', 85000.00, 0.00, 0,   85000.00, FALSE, 0),
('seed-item-confirmed-g7', 'seed-booking-confirmed', 20001, 'G7', 'VIP',     120000.00, 0.00, 100, 120000.00, FALSE, 0),
('seed-item-confirmed-g8', 'seed-booking-confirmed', 20002, 'G8', 'VIP',     120000.00, 0.00, 100, 120000.00, FALSE, 0),
('seed-item-expired-b5',   'seed-booking-expired',   30001, 'B5', 'STANDARD', 85000.00, 0.00, 0,   85000.00, FALSE, 0),
('seed-item-cancelled-v1', 'seed-booking-cancelled', 40001, 'V1', 'VIP',     120000.00, 0.00, 0,  120000.00, FALSE, 0),
('seed-item-counter-c3',   'seed-booking-counter',   50001, 'C3', 'STANDARD', 85000.00, 0.00, 0,   85000.00, FALSE, 0)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. inventory_reservation
-- ---------------------------------------------------------------------------
INSERT INTO inventory_reservation (
    inventory_reservation_id, booking_id, hold_reference, hold_token,
    inventory_status, expires_at, confirmed_at, released_at,
    version, created_at, updated_at
) VALUES
(
    'seed-inventory-pending', 'seed-booking-pending',
    'seed-hold-ref-pending', 'seed-hold-token-pending',
    'HELD', TIMESTAMPTZ '2030-08-01 08:55:00+07', NULL, NULL,
    0, TIMESTAMPTZ '2030-08-01 08:40:00+07', TIMESTAMPTZ '2030-08-01 08:40:00+07'
),
(
    'seed-inventory-confirmed', 'seed-booking-confirmed',
    'seed-hold-ref-confirmed', 'seed-hold-token-confirmed',
    'SOLD', TIMESTAMPTZ '2030-08-01 18:00:00+07',
    TIMESTAMPTZ '2030-08-01 17:48:02+07', NULL,
    1, TIMESTAMPTZ '2030-08-01 17:40:00+07', TIMESTAMPTZ '2030-08-01 17:48:02+07'
),
(
    'seed-inventory-expired', 'seed-booking-expired',
    'seed-hold-ref-expired', 'seed-hold-token-expired',
    'RELEASED', TIMESTAMPTZ '2030-07-20 14:15:00+07',
    NULL, TIMESTAMPTZ '2030-07-20 14:15:01+07',
    1, TIMESTAMPTZ '2030-07-20 14:00:00+07', TIMESTAMPTZ '2030-07-20 14:15:01+07'
),
(
    'seed-inventory-cancelled', 'seed-booking-cancelled',
    'seed-hold-ref-cancelled', 'seed-hold-token-cancelled',
    'CANCELLED', TIMESTAMPTZ '2030-08-02 19:00:00+07',
    TIMESTAMPTZ '2030-07-25 10:05:02+07', TIMESTAMPTZ '2030-07-26 09:10:00+07',
    2, TIMESTAMPTZ '2030-07-25 10:00:00+07', TIMESTAMPTZ '2030-07-26 09:10:00+07'
),
(
    'seed-inventory-counter', 'seed-booking-counter',
    'seed-hold-ref-counter', 'seed-hold-token-counter',
    'SOLD', TIMESTAMPTZ '2030-08-03 18:20:00+07',
    TIMESTAMPTZ '2030-08-03 18:05:01+07', NULL,
    1, TIMESTAMPTZ '2030-08-03 18:04:00+07', TIMESTAMPTZ '2030-08-03 18:05:01+07'
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. booking_refund
-- ---------------------------------------------------------------------------
INSERT INTO booking_refund (
    refund_id, booking_id, payment_reference, refund_reference,
    idempotency_key, amount, cash_amount, points_amount,
    promotion_amount, concession_amount, currency,
    reason_code, reason, refund_status, completed_at,
    version, created_at, updated_at
) VALUES (
    'seed-refund-cancelled', 'seed-booking-cancelled',
    'seed-payment-cancelled', 'seed-refund-provider-001',
    'seed-idem-refund-cancelled',
    120000.00, 120000.00, 0.00, 0.00, 0.00, 'VND',
    'CUSTOMER_CANCELLATION', 'Khách hàng hủy trước thời hạn',
    'SUCCEEDED', TIMESTAMPTZ '2030-07-26 09:09:00+07',
    1, TIMESTAMPTZ '2030-07-26 09:05:00+07', TIMESTAMPTZ '2030-07-26 09:09:00+07'
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. booking_cancellation
-- ---------------------------------------------------------------------------
INSERT INTO booking_cancellation (
    cancellation_id, booking_id, refund_id, idempotency_key, request_hash,
    source, reason_code, reason, actor_id, correlation_id,
    cancellation_status, before_snapshot, after_snapshot,
    requested_at, completed_at, version, updated_at
) VALUES (
    'seed-cancellation-completed', 'seed-booking-cancelled',
    'seed-refund-cancelled', 'seed-idem-cancellation-001',
    'sha256:seed-cancellation-request',
    'MEMBER', 'CHANGE_OF_PLAN', 'Không thể đến rạp',
    'seed-account-003', 'seed-correlation-cancelled',
    'COMPLETED',
    '{"bookingStatus":"CONFIRMED","refundStatus":"NOT_REQUESTED","inventoryStatus":"SOLD"}',
    '{"bookingStatus":"CANCELLED","refundStatus":"SUCCEEDED","inventoryStatus":"CANCELLED"}',
    TIMESTAMPTZ '2030-07-26 09:05:00+07',
    TIMESTAMPTZ '2030-07-26 09:10:00+07',
    1, TIMESTAMPTZ '2030-07-26 09:10:00+07'
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. ticket
-- One ticket per sellable seat.
-- ---------------------------------------------------------------------------
INSERT INTO ticket (
    ticket_id, booking_id, booking_item_id, account_id, showtime_id,
    movie_name, cluster_id, cluster_name, cinema_room_name,
    seat_code, seat_type, price, ticket_status, checked_in_at,
    issued_by, version, issued_at, updated_at
) VALUES
(
    'seed-ticket-confirmed-g7', 'seed-booking-confirmed', 'seed-item-confirmed-g7',
    'seed-account-001', 1002, 'Avengers: Endgame', 1, 'CinePrime Quận 1',
    'Phòng IMAX 02', 'G7', 'VIP', 120000.00, 'USED',
    TIMESTAMPTZ '2030-08-01 18:45:00+07', 'SYSTEM', 1,
    TIMESTAMPTZ '2030-08-01 17:48:03+07', TIMESTAMPTZ '2030-08-01 18:45:00+07'
),
(
    'seed-ticket-confirmed-g8', 'seed-booking-confirmed', 'seed-item-confirmed-g8',
    'seed-account-001', 1002, 'Avengers: Endgame', 1, 'CinePrime Quận 1',
    'Phòng IMAX 02', 'G8', 'VIP', 120000.00, 'VALID',
    NULL, 'SYSTEM', 0,
    TIMESTAMPTZ '2030-08-01 17:48:03+07', TIMESTAMPTZ '2030-08-01 17:48:03+07'
),
(
    'seed-ticket-cancelled-v1', 'seed-booking-cancelled', 'seed-item-cancelled-v1',
    'seed-account-003', 1004, 'Biển Đêm', 2, 'CinePrime Thủ Đức',
    'Phòng VIP 02', 'V1', 'VIP', 120000.00, 'CANCELLED',
    NULL, 'SYSTEM', 1,
    TIMESTAMPTZ '2030-07-25 10:05:03+07', TIMESTAMPTZ '2030-07-26 09:10:00+07'
),
(
    'seed-ticket-counter-c3', 'seed-booking-counter', 'seed-item-counter-c3',
    'seed-counter-customer', 1005, 'Mật Mã Thành Phố', 1, 'CinePrime Quận 1',
    'Phòng Large 03', 'C3', 'STANDARD', 85000.00, 'VALID',
    NULL, 'seed-employee-001', 0,
    TIMESTAMPTZ '2030-08-03 18:05:02+07', TIMESTAMPTZ '2030-08-03 18:05:02+07'
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7. booking_ticket_pass
-- A booking has one QR/pass; backend still stores one ticket per seat.
-- token_ciphertext values are non-production placeholders for local testing.
-- ---------------------------------------------------------------------------
INSERT INTO booking_ticket_pass (
    ticket_pass_id, booking_id, token_hash, token_ciphertext,
    key_version, pass_status, revoked_at, revoked_reason,
    version, issued_at, updated_at
) VALUES
(
    'seed-pass-confirmed', 'seed-booking-confirmed',
    'sha256:seed-pass-confirmed', 'encrypted:seed-pass-confirmed',
    'seed-key-v1', 'ACTIVE', NULL, NULL,
    0, TIMESTAMPTZ '2030-08-01 17:48:03+07', TIMESTAMPTZ '2030-08-01 17:48:03+07'
),
(
    'seed-pass-cancelled', 'seed-booking-cancelled',
    'sha256:seed-pass-cancelled', 'encrypted:seed-pass-cancelled',
    'seed-key-v1', 'REVOKED',
    TIMESTAMPTZ '2030-07-26 09:10:00+07', 'BOOKING_CANCELLED',
    1, TIMESTAMPTZ '2030-07-25 10:05:03+07', TIMESTAMPTZ '2030-07-26 09:10:00+07'
),
(
    'seed-pass-counter', 'seed-booking-counter',
    'sha256:seed-pass-counter', 'encrypted:seed-pass-counter',
    'seed-key-v1', 'ACTIVE', NULL, NULL,
    0, TIMESTAMPTZ '2030-08-03 18:05:02+07', TIMESTAMPTZ '2030-08-03 18:05:02+07'
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 8. ticket_check_in
-- ---------------------------------------------------------------------------
INSERT INTO ticket_check_in (
    check_in_id, ticket_id, caller_scope, idempotency_key, request_hash,
    check_in_mode, gate_id, checked_by, device_id, result,
    checked_in_at, created_at
) VALUES (
    'seed-checkin-g7', 'seed-ticket-confirmed-g7',
    'CLUSTER:1', 'seed-idem-checkin-g7', 'sha256:seed-checkin-g7',
    'SELECTED', 'Q1-GATE-02', 'seed-employee-001', 'seed-scanner-01',
    'CHECKED_IN',
    TIMESTAMPTZ '2030-08-01 18:45:00+07',
    TIMESTAMPTZ '2030-08-01 18:45:00+07'
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 9. booking_operation (durable idempotency records)
-- ---------------------------------------------------------------------------
INSERT INTO booking_operation (
    operation_id, caller_scope, operation_name, idempotency_key, request_hash,
    booking_id, operation_status, http_status, response_snapshot,
    poll_reference, correlation_id, expires_at,
    version, created_at, updated_at
) VALUES
(
    'seed-operation-pending', 'ACCOUNT:seed-account-001', 'CREATE_BOOKING',
    'seed-idem-create-pending', 'sha256:seed-create-pending',
    'seed-booking-pending', 'SUCCEEDED', 201,
    '{"code":1000,"result":{"bookingId":"seed-booking-pending","status":"PENDING_PAYMENT"}}',
    NULL, 'seed-correlation-pending',
    TIMESTAMPTZ '2030-08-02 08:40:00+07',
    0, TIMESTAMPTZ '2030-08-01 08:40:00+07', TIMESTAMPTZ '2030-08-01 08:40:01+07'
),
(
    'seed-operation-confirmed', 'ACCOUNT:seed-account-001', 'CREATE_BOOKING',
    'seed-idem-create-confirmed', 'sha256:seed-create-confirmed',
    'seed-booking-confirmed', 'SUCCEEDED', 201,
    '{"code":1000,"result":{"bookingId":"seed-booking-confirmed","status":"PENDING_PAYMENT"}}',
    NULL, 'seed-correlation-confirmed',
    TIMESTAMPTZ '2030-08-02 17:40:00+07',
    0, TIMESTAMPTZ '2030-08-01 17:40:00+07', TIMESTAMPTZ '2030-08-01 17:40:01+07'
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 10. payment_event_inbox
-- ---------------------------------------------------------------------------
INSERT INTO payment_event_inbox (
    inbox_id, event_source, provider_event_id, event_type, event_version,
    booking_id, payment_reference, amount, currency, correlation_id,
    payload, processing_status, attempt_count,
    received_at, processed_at, next_attempt_at, last_error
) VALUES
(
    'seed-inbox-confirmed', 'PAYMENT_SERVICE', 'seed-provider-event-001',
    'PAYMENT_SUCCEEDED', '1',
    'seed-booking-confirmed', 'seed-payment-confirmed',
    280000.00, 'VND', 'seed-correlation-confirmed',
    '{"eventId":"seed-provider-event-001","bookingId":"seed-booking-confirmed","amount":280000,"currency":"VND"}',
    'PROCESSED', 1,
    TIMESTAMPTZ '2030-08-01 17:48:01+07',
    TIMESTAMPTZ '2030-08-01 17:48:03+07', NULL, NULL
),
(
    'seed-inbox-cancelled', 'PAYMENT_SERVICE', 'seed-provider-event-002',
    'REFUND_SUCCEEDED', '1',
    'seed-booking-cancelled', 'seed-payment-cancelled',
    120000.00, 'VND', 'seed-correlation-cancelled',
    '{"eventId":"seed-provider-event-002","bookingId":"seed-booking-cancelled","refundStatus":"SUCCEEDED"}',
    'PROCESSED', 1,
    TIMESTAMPTZ '2030-07-26 09:09:00+07',
    TIMESTAMPTZ '2030-07-26 09:10:00+07', NULL, NULL
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 11. compensation_task
-- ---------------------------------------------------------------------------
INSERT INTO compensation_task (
    task_id, booking_id, operation_name, target_service, target_reference,
    idempotency_key, task_status, command_payload, correlation_id,
    attempt_count, next_attempt_at, claimed_by, claim_until, last_error,
    version, created_at, updated_at
) VALUES (
    'seed-compensation-expired', 'seed-booking-expired',
    'RELEASE_INVENTORY', 'movie-service', 'seed-hold-token-expired',
    'seed-idem-compensation-expired', 'SUCCEEDED',
    '{"holdToken":"seed-hold-token-expired","bookingId":"seed-booking-expired","reason":"PAYMENT_EXPIRED"}',
    'seed-correlation-expired',
    1, NULL, NULL, NULL, NULL,
    1, TIMESTAMPTZ '2030-07-20 14:15:00+07', TIMESTAMPTZ '2030-07-20 14:15:01+07'
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 12. outbox_event
-- ---------------------------------------------------------------------------
INSERT INTO outbox_event (
    event_id, booking_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, schema_version, correlation_id, causation_id, partition_key,
    payload, publish_status, attempt_count, next_attempt_at,
    occurred_at, published_at, last_error
) VALUES
(
    'seed-outbox-confirmed', 'seed-booking-confirmed',
    'BOOKING', 'seed-booking-confirmed', 1,
    'BOOKING_CONFIRMED', '1', 'seed-correlation-confirmed',
    'seed-provider-event-001', 'seed-booking-confirmed',
    '{"bookingId":"seed-booking-confirmed","status":"CONFIRMED","ticketCount":2}',
    'PUBLISHED', 1, NULL,
    TIMESTAMPTZ '2030-08-01 17:48:03+07',
    TIMESTAMPTZ '2030-08-01 17:48:04+07', NULL
),
(
    'seed-outbox-expired', 'seed-booking-expired',
    'BOOKING', 'seed-booking-expired', 1,
    'BOOKING_EXPIRED', '1', 'seed-correlation-expired',
    'seed-expiry-job-001', 'seed-booking-expired',
    '{"bookingId":"seed-booking-expired","status":"EXPIRED"}',
    'PUBLISHED', 1, NULL,
    TIMESTAMPTZ '2030-07-20 14:15:01+07',
    TIMESTAMPTZ '2030-07-20 14:15:02+07', NULL
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 13. booking_reconciliation
-- ---------------------------------------------------------------------------
INSERT INTO booking_reconciliation (
    reconciliation_id, booking_id, case_type, severity,
    reconciliation_status, payment_reference, hold_reference, cluster_id,
    evidence, owner_id, created_by, correlation_id, idempotency_key,
    version, created_at, updated_at
) VALUES (
    'seed-reconciliation-001', 'seed-booking-confirmed',
    'PAYMENT_INVENTORY_MISMATCH', 'HIGH', 'MANUAL_REVIEW',
    'seed-payment-confirmed', 'seed-hold-ref-confirmed', 1,
    '{"paymentStatus":"SUCCEEDED","bookingStatus":"CONFIRMED","note":"Seed case for operations testing"}',
    'seed-admin-001', 'seed-employee-001',
    'seed-correlation-reconciliation', 'seed-idem-reconciliation-001',
    1, TIMESTAMPTZ '2030-08-01 17:49:00+07', TIMESTAMPTZ '2030-08-01 17:50:00+07'
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 14. booking_reconciliation_attempt
-- ---------------------------------------------------------------------------
INSERT INTO booking_reconciliation_attempt (
    attempt_id, reconciliation_id, action_type, attempt_status,
    reason, requested_by, before_snapshot, after_snapshot,
    idempotency_key, last_error, created_at, updated_at
) VALUES (
    'seed-reconciliation-attempt-001', 'seed-reconciliation-001',
    'VERIFY_INVENTORY', 'FAILED',
    'Kiểm tra trạng thái inventory phục vụ test vận hành',
    'seed-admin-001',
    '{"inventoryStatus":"UNKNOWN"}',
    '{"inventoryStatus":"SOLD"}',
    'seed-idem-reconciliation-attempt-001',
    'Seed failure: downstream timeout',
    TIMESTAMPTZ '2030-08-01 17:50:00+07', TIMESTAMPTZ '2030-08-01 17:50:05+07'
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 15. counter_payment
-- ---------------------------------------------------------------------------
INSERT INTO counter_payment (
    counter_payment_id, booking_id, payment_reference, receipt_reference,
    cashier_id, terminal_id, cluster_id, payment_method,
    amount, currency, collected_at, created_at
) VALUES (
    'seed-counter-payment-001', 'seed-booking-counter',
    'seed-counter-payment-ref', 'SEED-RECEIPT-Q1-0001',
    'seed-employee-001', 'Q1-POS-03', 1, 'CASH',
    85000.00, 'VND',
    TIMESTAMPTZ '2030-08-03 18:05:00+07',
    TIMESTAMPTZ '2030-08-03 18:05:00+07'
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 16. booking_quote
-- ---------------------------------------------------------------------------
INSERT INTO booking_quote (
    quote_id, account_id, showtime_id,
    subtotal, discount_amount, fee_amount, final_amount,
    currency, quote_status, request_hash, expires_at, created_at
) VALUES (
    'seed-quote-001', 'seed-account-004', 1006,
    335000.00, 55000.00, 0.00, 280000.00,
    'VND', 'ACTIVE', 'sha256:seed-quote-001',
    TIMESTAMPTZ '2030-08-04 17:15:00+07',
    TIMESTAMPTZ '2030-08-04 17:00:00+07'
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 17. booking_quote_item
-- ---------------------------------------------------------------------------
INSERT INTO booking_quote_item (
    quote_item_id, quote_id, item_type, external_item_id, item_name,
    quantity, unit_price, discount_amount, final_amount
) VALUES
('seed-quote-item-seat-g7', 'seed-quote-001', 'SEAT', '60001', 'Ghế VIP G7', 1, 120000.00, 17500.00, 102500.00),
('seed-quote-item-seat-g8', 'seed-quote-001', 'SEAT', '60002', 'Ghế VIP G8', 1, 120000.00, 17500.00, 102500.00),
('seed-quote-item-combo',   'seed-quote-001', 'CONCESSION', 'COMBO-2', 'Combo bắp nước đôi', 1, 95000.00, 20000.00, 75000.00)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 18. promotion_reservation
-- ---------------------------------------------------------------------------
INSERT INTO promotion_reservation (
    promotion_reservation_id, booking_id, promotion_id, promotion_code,
    external_reservation_id, discount_amount, reservation_status,
    expires_at, idempotency_key, created_at, updated_at
) VALUES (
    'seed-promotion-reservation-001', 'seed-booking-confirmed',
    'seed-promotion-summer-2030', 'SUMMER30',
    'seed-external-promotion-001', 35000.00, 'COMMITTED',
    TIMESTAMPTZ '2030-08-01 18:00:00+07',
    'seed-idem-promotion-001',
    TIMESTAMPTZ '2030-08-01 17:40:00+07', TIMESTAMPTZ '2030-08-01 17:48:03+07'
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 19. loyalty_reservation
-- ---------------------------------------------------------------------------
INSERT INTO loyalty_reservation (
    loyalty_reservation_id, booking_id, external_reservation_id,
    points_reserved, discount_amount, reservation_status,
    expires_at, idempotency_key, created_at, updated_at
) VALUES (
    'seed-loyalty-reservation-001', 'seed-booking-confirmed',
    'seed-external-loyalty-001',
    200, 20000.00, 'COMMITTED',
    TIMESTAMPTZ '2030-08-01 18:00:00+07',
    'seed-idem-loyalty-001',
    TIMESTAMPTZ '2030-08-01 17:40:00+07', TIMESTAMPTZ '2030-08-01 17:48:03+07'
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 20. booking_concession_item
-- ---------------------------------------------------------------------------
INSERT INTO booking_concession_item (
    concession_item_id, booking_id, sku, item_name,
    quantity, unit_price, discount_amount, final_amount,
    fulfillment_cluster_id, external_reservation_id,
    reservation_status, idempotency_key, created_at, updated_at
) VALUES (
    'seed-concession-001', 'seed-booking-confirmed',
    'COMBO-2', 'Combo bắp nước đôi',
    1, 95000.00, 0.00, 95000.00,
    1, 'seed-external-concession-001',
    'COMMITTED', 'seed-idem-concession-001',
    TIMESTAMPTZ '2030-08-01 17:40:00+07', TIMESTAMPTZ '2030-08-01 17:48:03+07'
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 21. booking_audit_log
-- ---------------------------------------------------------------------------
INSERT INTO booking_audit_log (
    audit_id, booking_id, action, actor_id, actor_type,
    reason, before_snapshot, after_snapshot, correlation_id, created_at
) VALUES
(
    'seed-audit-pending-created', 'seed-booking-pending',
    'BOOKING_CREATED', 'seed-account-001', 'MEMBER',
    'Seed online booking',
    NULL, '{"bookingStatus":"PENDING_PAYMENT","inventoryStatus":"HELD"}',
    'seed-correlation-pending', TIMESTAMPTZ '2030-08-01 08:40:00+07'
),
(
    'seed-audit-confirmed', 'seed-booking-confirmed',
    'BOOKING_CONFIRMED', 'SYSTEM', 'SERVICE',
    'Payment succeeded and inventory confirmed',
    '{"bookingStatus":"PENDING_PAYMENT","inventoryStatus":"HELD"}',
    '{"bookingStatus":"CONFIRMED","inventoryStatus":"SOLD"}',
    'seed-correlation-confirmed', TIMESTAMPTZ '2030-08-01 17:48:03+07'
),
(
    'seed-audit-cancelled', 'seed-booking-cancelled',
    'BOOKING_CANCELLED', 'seed-account-003', 'MEMBER',
    'Customer cancellation completed',
    '{"bookingStatus":"CONFIRMED","refundStatus":"NOT_REQUESTED"}',
    '{"bookingStatus":"CANCELLED","refundStatus":"SUCCEEDED"}',
    'seed-correlation-cancelled', TIMESTAMPTZ '2030-07-26 09:10:00+07'
),
(
    'seed-audit-counter-created', 'seed-booking-counter',
    'COUNTER_BOOKING_CREATED', 'seed-employee-001', 'EMPLOYEE',
    'Cash sale at Q1-POS-03',
    NULL, '{"bookingStatus":"CONFIRMED","paymentStatus":"SUCCEEDED"}',
    'seed-correlation-counter', TIMESTAMPTZ '2030-08-03 18:05:02+07'
)
ON CONFLICT DO NOTHING;

-- Verification result: one row per canonical table with total/seed row counts.
SELECT table_name, total_rows, seed_rows
FROM (
    SELECT 'booking' AS table_name, COUNT(*) AS total_rows,
           COUNT(*) FILTER (WHERE booking_id LIKE 'seed-%') AS seed_rows FROM booking
    UNION ALL SELECT 'booking_item', COUNT(*), COUNT(*) FILTER (WHERE booking_item_id LIKE 'seed-%') FROM booking_item
    UNION ALL SELECT 'inventory_reservation', COUNT(*), COUNT(*) FILTER (WHERE inventory_reservation_id LIKE 'seed-%') FROM inventory_reservation
    UNION ALL SELECT 'booking_refund', COUNT(*), COUNT(*) FILTER (WHERE refund_id LIKE 'seed-%') FROM booking_refund
    UNION ALL SELECT 'booking_cancellation', COUNT(*), COUNT(*) FILTER (WHERE cancellation_id LIKE 'seed-%') FROM booking_cancellation
    UNION ALL SELECT 'ticket', COUNT(*), COUNT(*) FILTER (WHERE ticket_id LIKE 'seed-%') FROM ticket
    UNION ALL SELECT 'booking_ticket_pass', COUNT(*), COUNT(*) FILTER (WHERE ticket_pass_id LIKE 'seed-%') FROM booking_ticket_pass
    UNION ALL SELECT 'ticket_check_in', COUNT(*), COUNT(*) FILTER (WHERE check_in_id LIKE 'seed-%') FROM ticket_check_in
    UNION ALL SELECT 'booking_operation', COUNT(*), COUNT(*) FILTER (WHERE operation_id LIKE 'seed-%') FROM booking_operation
    UNION ALL SELECT 'payment_event_inbox', COUNT(*), COUNT(*) FILTER (WHERE inbox_id LIKE 'seed-%') FROM payment_event_inbox
    UNION ALL SELECT 'compensation_task', COUNT(*), COUNT(*) FILTER (WHERE task_id LIKE 'seed-%') FROM compensation_task
    UNION ALL SELECT 'outbox_event', COUNT(*), COUNT(*) FILTER (WHERE event_id LIKE 'seed-%') FROM outbox_event
    UNION ALL SELECT 'booking_reconciliation', COUNT(*), COUNT(*) FILTER (WHERE reconciliation_id LIKE 'seed-%') FROM booking_reconciliation
    UNION ALL SELECT 'booking_reconciliation_attempt', COUNT(*), COUNT(*) FILTER (WHERE attempt_id LIKE 'seed-%') FROM booking_reconciliation_attempt
    UNION ALL SELECT 'counter_payment', COUNT(*), COUNT(*) FILTER (WHERE counter_payment_id LIKE 'seed-%') FROM counter_payment
    UNION ALL SELECT 'booking_quote', COUNT(*), COUNT(*) FILTER (WHERE quote_id LIKE 'seed-%') FROM booking_quote
    UNION ALL SELECT 'booking_quote_item', COUNT(*), COUNT(*) FILTER (WHERE quote_item_id LIKE 'seed-%') FROM booking_quote_item
    UNION ALL SELECT 'promotion_reservation', COUNT(*), COUNT(*) FILTER (WHERE promotion_reservation_id LIKE 'seed-%') FROM promotion_reservation
    UNION ALL SELECT 'loyalty_reservation', COUNT(*), COUNT(*) FILTER (WHERE loyalty_reservation_id LIKE 'seed-%') FROM loyalty_reservation
    UNION ALL SELECT 'booking_concession_item', COUNT(*), COUNT(*) FILTER (WHERE concession_item_id LIKE 'seed-%') FROM booking_concession_item
    UNION ALL SELECT 'booking_audit_log', COUNT(*), COUNT(*) FILTER (WHERE audit_id LIKE 'seed-%') FROM booking_audit_log
) AS verification
ORDER BY table_name;
