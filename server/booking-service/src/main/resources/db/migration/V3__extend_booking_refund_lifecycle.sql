ALTER TABLE booking DROP CONSTRAINT IF EXISTS ck_booking_status;
ALTER TABLE booking ADD CONSTRAINT ck_booking_status CHECK (
    booking_status IN (
        'PENDING_PAYMENT',
        'CONFIRM_PENDING',
        'CONFIRMED',
        'CANCEL_REQUESTED',
        'REFUND_PENDING',
        'REFUNDED',
        'CANCELLED',
        'EXPIRED'
    )
);
