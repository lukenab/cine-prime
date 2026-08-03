package bookingservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "payment_event_inbox", uniqueConstraints = {
        @UniqueConstraint(name = "uk_inbox_event", columnNames = {"event_source", "provider_event_id"})
}, indexes = {
        @Index(name = "idx_inbox_status_received", columnList = "processing_status,received_at")
})
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PaymentEventInbox {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "inbox_id", length = 50)
    String inboxId;

    @Column(name = "event_source", length = 50, nullable = false)
    String eventSource;

    @Column(name = "provider_event_id", length = 100, nullable = false)
    String eventId;

    @Column(name = "event_type", length = 100, nullable = false)
    String eventType;

    @Column(name = "event_version", length = 20, nullable = false)
    String eventVersion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id")
    Booking booking;

    @Column(name = "payment_reference", length = 100)
    String paymentReference;

    @Column(name = "amount", precision = 15, scale = 2)
    BigDecimal amount;

    @Column(name = "currency", length = 3)
    String currency;

    @Column(name = "correlation_id", length = 100, nullable = false)
    String correlationId;

    @Column(name = "payload", columnDefinition = "text", nullable = false)
    String payload;

    @Column(name = "processing_status", length = 30, nullable = false)
    String status;

    @Column(name = "attempt_count", nullable = false)
    @Builder.Default
    Integer attemptCount = 0;

    @CreationTimestamp
    @Column(name = "received_at", nullable = false, updatable = false)
    OffsetDateTime receivedAt;

    @Column(name = "processed_at")
    OffsetDateTime processedAt;

    @Column(name = "next_attempt_at")
    OffsetDateTime nextAttemptAt;

    @Column(name = "last_error", columnDefinition = "text")
    String lastError;
}
