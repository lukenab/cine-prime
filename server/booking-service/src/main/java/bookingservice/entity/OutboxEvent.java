package bookingservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(name = "outbox_event", indexes = {
        @Index(name = "idx_outbox_claim", columnList = "publish_status,next_attempt_at"),
        @Index(name = "idx_outbox_aggregate", columnList = "aggregate_type,aggregate_id")
})
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class OutboxEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "event_id", length = 50)
    String eventId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id")
    Booking booking;

    @Column(name = "aggregate_type", length = 50, nullable = false)
    String aggregateType;

    @Column(name = "aggregate_id", length = 50, nullable = false)
    String aggregateId;

    @Column(name = "aggregate_version", nullable = false)
    Long aggregateVersion;

    @Column(name = "event_type", length = 100, nullable = false)
    String eventType;

    @Column(name = "schema_version", length = 20, nullable = false)
    String schemaVersion;

    @Column(name = "correlation_id", length = 100, nullable = false)
    String correlationId;

    @Column(name = "causation_id", length = 100)
    String causationId;

    @Column(name = "partition_key", length = 100, nullable = false)
    String partitionKey;

    @Column(name = "payload", columnDefinition = "text", nullable = false)
    String payload;

    @Column(name = "publish_status", length = 30, nullable = false)
    String status;

    @Column(name = "attempt_count", nullable = false)
    @Builder.Default
    Integer attemptCount = 0;

    @Column(name = "next_attempt_at")
    OffsetDateTime nextAttemptAt;

    @CreationTimestamp
    @Column(name = "occurred_at", nullable = false, updatable = false)
    OffsetDateTime occurredAt;

    @Column(name = "published_at")
    OffsetDateTime publishedAt;

    @Column(name = "last_error", columnDefinition = "text")
    String lastError;
}
