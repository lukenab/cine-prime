package paymentservice.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "payment_attempt")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentAttempt {
    @Id
    @Column(name = "payment_id", length = 50)
    private String paymentId;

    @Column(name = "booking_id", nullable = false, length = 50)
    private String bookingId;

    @Column(name = "account_id", nullable = false, length = 50)
    private String accountId;

    @Column(nullable = false, length = 30)
    private String provider;

    @Column(name = "provider_txn_ref", nullable = false, unique = true, length = 100)
    private String providerTxnRef;

    @Column(name = "provider_transaction_id", length = 100)
    private String providerTransactionId;

    @Column(name = "provider_created_at")
    private OffsetDateTime providerCreatedAt;

    @Column(name = "idempotency_key", nullable = false, length = 120)
    private String idempotencyKey;

    @Column(name = "request_hash", nullable = false, length = 64)
    private String requestHash;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 3)
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private PaymentStatus status;

    @Column(name = "payment_url", columnDefinition = "TEXT")
    private String paymentUrl;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "paid_at")
    private OffsetDateTime paidAt;

    @Column(name = "bank_code", length = 30)
    private String bankCode;

    @Column(name = "card_type", length = 30)
    private String cardType;

    @Column(name = "failure_code", length = 50)
    private String failureCode;

    @Column(name = "failure_message", length = 500)
    private String failureMessage;

    @Column(name = "outcome_event_id", length = 120)
    private String outcomeEventId;

    @Column(name = "outcome_event_type", length = 50)
    private String outcomeEventType;

    @Column(name = "outcome_payload", columnDefinition = "TEXT")
    private String outcomePayload;

    @Builder.Default
    @Column(name = "outcome_delivered", nullable = false)
    private boolean outcomeDelivered = false;

    @Builder.Default
    @Column(name = "delivery_attempts", nullable = false)
    private int deliveryAttempts = 0;

    @Column(name = "next_delivery_at")
    private OffsetDateTime nextDeliveryAt;

    @Column(name = "last_delivery_error", length = 1000)
    private String lastDeliveryError;

    @Version
    @Column(nullable = false)
    private Long version;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    void prePersist() {
        OffsetDateTime now = OffsetDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
