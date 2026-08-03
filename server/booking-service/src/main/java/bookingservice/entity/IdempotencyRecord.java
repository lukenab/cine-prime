package bookingservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(name = "booking_operation", uniqueConstraints = {
        @UniqueConstraint(name = "uk_operation_caller_name_key",
                columnNames = {"caller_scope", "operation_name", "idempotency_key"})
}, indexes = {
        @Index(name = "idx_operation_status_expiry", columnList = "operation_status,expires_at")
})
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class IdempotencyRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "operation_id", length = 50)
    String recordId;

    @Column(name = "caller_scope", length = 100, nullable = false)
    String callerScope;

    @Column(name = "operation_name", length = 100, nullable = false)
    String operationScope;

    @Column(name = "idempotency_key", length = 100, nullable = false)
    String idempotencyKey;

    @Column(name = "request_hash", length = 128, nullable = false)
    String requestHash;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id")
    Booking booking;

    @Enumerated(EnumType.STRING)
    @Column(name = "operation_status", length = 30, nullable = false)
    OperationStatus status;

    @Column(name = "http_status")
    Integer httpStatus;

    @Column(name = "response_snapshot", columnDefinition = "text")
    String responseBody;

    @Column(name = "poll_reference", length = 100)
    String pollReference;

    @Column(name = "correlation_id", length = 100, nullable = false)
    String correlationId;

    @Column(name = "expires_at", nullable = false)
    OffsetDateTime expiresAt;

    @Version
    @Column(name = "version", nullable = false)
    Long version;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    OffsetDateTime updatedAt;
}
