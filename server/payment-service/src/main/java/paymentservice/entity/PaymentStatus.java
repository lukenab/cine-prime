package paymentservice.entity;

public enum PaymentStatus {
    INITIATED,
    PENDING,
    PAID,
    REFUND_PENDING,
    REFUNDED,
    FAILED,
    CANCELLED,
    EXPIRED
}
