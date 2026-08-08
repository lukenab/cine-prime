-- Deterministic demo data for the Admin > Refunds & reconciliation workbench.
-- Run after payment-service has started once (Flyway V5 must be applied):
--   docker exec -i postgres psql -U postgres -d payment_db -v ON_ERROR_STOP=1 < scripts/demo/seed-payment-operations.sql
-- These records are isolated by the demo-* identifiers and may be safely re-run.

BEGIN;

DELETE FROM payment_reconciliation_case
WHERE booking_id IN ('demo-refund-booking-001', 'demo-reconciliation-booking-001');

DELETE FROM payment_refund
WHERE booking_id = 'demo-refund-booking-001';

INSERT INTO payment_attempt (
    payment_id, booking_id, account_id, provider, provider_txn_ref,
    provider_transaction_id, provider_created_at, idempotency_key, request_hash,
    amount, currency, status, payment_url, expires_at, paid_at, bank_code,
    card_type, outcome_delivered, delivery_attempts, version, created_at, updated_at
) VALUES
(
    'demo-refund-payment-001', 'demo-refund-booking-001',
    'demo-admin-account', 'VNPAY', 'DEMO-REFUND-TXN-001', 'DEMO-VNPAY-001',
    TIMESTAMPTZ '2026-08-07 10:00:00+07:00', 'demo-refund-session-001',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    229000.00, 'VND', 'PAID', NULL,
    TIMESTAMPTZ '2026-08-07 10:15:00+07:00', TIMESTAMPTZ '2026-08-07 10:02:00+07:00',
    'NCB', 'ATM', TRUE, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT (payment_id) DO UPDATE SET
    booking_id = EXCLUDED.booking_id,
    status = 'PAID',
    amount = EXCLUDED.amount,
    currency = EXCLUDED.currency,
    paid_at = EXCLUDED.paid_at,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO payment_attempt (
    payment_id, booking_id, account_id, provider, provider_txn_ref,
    provider_transaction_id, provider_created_at, idempotency_key, request_hash,
    amount, currency, status, payment_url, expires_at, paid_at, bank_code,
    card_type, outcome_delivered, delivery_attempts, version, created_at, updated_at
) VALUES (
    'demo-reconciliation-payment-001', 'demo-reconciliation-booking-001',
    'demo-admin-account', 'VNPAY', 'DEMO-RECON-TXN-001', 'DEMO-VNPAY-002',
    TIMESTAMPTZ '2026-08-07 11:00:00+07:00', 'demo-reconciliation-session-001',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    149000.00, 'VND', 'PAID', NULL,
    TIMESTAMPTZ '2026-08-07 11:15:00+07:00', TIMESTAMPTZ '2026-08-07 11:03:00+07:00',
    'VCB', 'ATM', TRUE, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT (payment_id) DO UPDATE SET
    booking_id = EXCLUDED.booking_id,
    status = 'PAID',
    amount = EXCLUDED.amount,
    currency = EXCLUDED.currency,
    paid_at = EXCLUDED.paid_at,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO payment_refund (
    refund_id, payment_id, booking_id, payment_reference, provider_refund_reference,
    idempotency_key, request_hash, amount, currency, reason_code, reason, status,
    failure_code, failure_message, completed_at, version, created_at, updated_at
) VALUES (
    'demo-refund-001', 'demo-refund-payment-001', 'demo-refund-booking-001',
    'DEMO-VNPAY-001', NULL, 'demo-refund-idempotency-001',
    'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    229000.00, 'VND', 'CUSTOMER_REQUEST', 'Demo refund awaiting provider confirmation.',
    'PENDING', NULL, NULL, NULL, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT (refund_id) DO UPDATE SET
    status = 'PENDING',
    provider_refund_reference = NULL,
    completed_at = NULL,
    failure_code = NULL,
    failure_message = NULL,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO payment_reconciliation_case (
    payment_id, booking_id, case_type, severity, status, details,
    attempt_count, next_attempt_at, created_at, resolved_at, resolved_by,
    resolution_note, updated_at
) VALUES (
    'demo-reconciliation-payment-001', 'demo-reconciliation-booking-001',
    'PAYMENT_OUTCOME_MISMATCH', 'HIGH', 'OPEN',
    'Demo case: provider payment succeeded but the booking outcome requires manual reconciliation.',
    0, NULL, CURRENT_TIMESTAMP, NULL, NULL, NULL, CURRENT_TIMESTAMP
);

COMMIT;

SELECT refund_id, booking_id, status, amount, currency, created_at
FROM payment_refund
WHERE refund_id = 'demo-refund-001';

SELECT case_id, booking_id, status, severity, attempt_count, created_at
FROM payment_reconciliation_case
WHERE booking_id = 'demo-reconciliation-booking-001';
