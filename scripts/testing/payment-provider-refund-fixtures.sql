-- Manual Postman fixture for issue #260.
-- Run this script on payment_db after Flyway migration V4 has completed.
-- The provider references below are deterministic test values; replace them
-- with a real successful VNPay sandbox transaction when testing a real refund.

BEGIN;

DELETE FROM payment_reconciliation_case
WHERE booking_id = 'refund-provider-booking-001';

DELETE FROM payment_refund
WHERE booking_id = 'refund-provider-booking-001';

INSERT INTO payment_attempt (
    payment_id,
    booking_id,
    account_id,
    provider,
    provider_txn_ref,
    provider_transaction_id,
    provider_created_at,
    idempotency_key,
    request_hash,
    amount,
    currency,
    status,
    payment_url,
    expires_at,
    paid_at,
    bank_code,
    card_type,
    outcome_delivered,
    delivery_attempts,
    version,
    created_at,
    updated_at
) VALUES (
    'refund-provider-payment-001',
    'refund-provider-booking-001',
    '15fcb315-bcc3-4c91-a4d6-c3449ffc1928',
    'VNPAY',
    'REFUNDTEST260001',
    'REFUND-VNPAY-TXN-001',
    TIMESTAMPTZ '2026-08-02 20:00:00+07:00',
    'refund-provider-payment-session-001',
    '7af96a5cc78f4976aa4f64e029078a0e8be6c4a03c6053d03b28f4c1d8a22600',
    100000.00,
    'VND',
    'PAID',
    NULL,
    TIMESTAMPTZ '2026-08-02 20:15:00+07:00',
    TIMESTAMPTZ '2026-08-02 20:02:00+07:00',
    'NCB',
    'ATM',
    TRUE,
    0,
    0,
    TIMESTAMPTZ '2026-08-02 20:00:00+07:00',
    CURRENT_TIMESTAMP
)
ON CONFLICT (payment_id) DO UPDATE SET
    booking_id = EXCLUDED.booking_id,
    account_id = EXCLUDED.account_id,
    provider = EXCLUDED.provider,
    provider_txn_ref = EXCLUDED.provider_txn_ref,
    provider_transaction_id = EXCLUDED.provider_transaction_id,
    provider_created_at = EXCLUDED.provider_created_at,
    idempotency_key = EXCLUDED.idempotency_key,
    request_hash = EXCLUDED.request_hash,
    amount = EXCLUDED.amount,
    currency = EXCLUDED.currency,
    status = EXCLUDED.status,
    payment_url = EXCLUDED.payment_url,
    expires_at = EXCLUDED.expires_at,
    paid_at = EXCLUDED.paid_at,
    bank_code = EXCLUDED.bank_code,
    card_type = EXCLUDED.card_type,
    failure_code = NULL,
    failure_message = NULL,
    outcome_delivered = EXCLUDED.outcome_delivered,
    delivery_attempts = EXCLUDED.delivery_attempts,
    version = payment_attempt.version + 1,
    updated_at = CURRENT_TIMESTAMP;

COMMIT;

SELECT
    payment_id,
    booking_id,
    account_id,
    provider_txn_ref,
    provider_transaction_id,
    amount,
    currency,
    status,
    provider_created_at,
    paid_at
FROM payment_attempt
WHERE payment_id = 'refund-provider-payment-001';
