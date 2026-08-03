package bookingservice.entity;

public enum BookingStatus {
    PENDING_PAYMENT,
    CONFIRM_PENDING,
    CONFIRMED,
    CANCEL_REQUESTED,
    REFUND_PENDING,
    REFUNDED,
    CANCELLED,
    EXPIRED
}
