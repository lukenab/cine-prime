package bookingservice.entity;

public enum BookingStatus {
    PENDING_PAYMENT,
    CONFIRM_PENDING,
    CONFIRMED,
    CANCEL_REQUESTED,
    CANCELLED,
    EXPIRED
}
