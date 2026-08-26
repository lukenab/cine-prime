package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Entity
@Table(name = "release_plan_bulk_decision_operation",
        uniqueConstraints = @UniqueConstraint(name = "uk_release_plan_bulk_decision_actor_key",
                columnNames = {"actor", "idempotency_key"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ReleasePlanBulkDecisionOperation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long operationId;

    @Column(nullable = false, length = 100)
    String actor;

    @Column(name = "idempotency_key", nullable = false, length = 128)
    String idempotencyKey;

    @Column(name = "request_hash", nullable = false, length = 64)
    String requestHash;

    @Column(nullable = false, length = 16)
    String status;

    @Column(name = "response_json", columnDefinition = "TEXT")
    String responseJson;

    @Column(name = "created_at", nullable = false)
    LocalDateTime createdAt;

    @Column(name = "completed_at")
    LocalDateTime completedAt;
}
