package workforceservice.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "workforce_outbox_event")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class WorkforceOutboxEvent {
    @Id @Column(name = "event_id", length = 36) private String eventId;
    @Column(name = "aggregate_type", nullable = false, length = 50) private String aggregateType;
    @Column(name = "aggregate_id", nullable = false, length = 36) private String aggregateId;
    @Column(name = "aggregate_version", nullable = false) private long aggregateVersion;
    @Column(name = "event_type", nullable = false, length = 100) private String eventType;
    @Column(name = "event_version", nullable = false, length = 20) private String eventVersion;
    @Column(name = "correlation_id", nullable = false, length = 100) private String correlationId;
    @Column(name = "causation_id", length = 100) private String causationId;
    @Column(name = "partition_key", nullable = false, length = 100) private String partitionKey;
    @Column(nullable = false, columnDefinition = "text") private String payload;
    @Column(name = "publish_status", nullable = false, length = 20) private String publishStatus;
    @Column(name = "attempt_count", nullable = false) private int attemptCount;
    @Column(name = "next_attempt_at") private OffsetDateTime nextAttemptAt;
    @Column(name = "occurred_at", nullable = false) private OffsetDateTime occurredAt;
    @Column(name = "published_at") private OffsetDateTime publishedAt;
    @Column(name = "last_error", columnDefinition = "text") private String lastError;
}
