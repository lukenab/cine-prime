package paymentservice.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "refund_approval_request", indexes = {
        @Index(name = "idx_refund_approval_refund", columnList = "refund_id,created_at"),
        @Index(name = "idx_refund_approval_status", columnList = "status,created_at")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RefundApprovalRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "request_id", length = 50)
    private String requestId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "refund_id", nullable = false)
    private PaymentRefund refund;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RefundApprovalStatus status;

    @Column(name = "requested_by", nullable = false, length = 50)
    private String requestedBy;

    @Column(name = "reviewed_by", length = 50)
    private String reviewedBy;

    @Column(name = "executed_by", length = 50)
    private String executedBy;

    @Column(name = "request_note", length = 1000)
    private String requestNote;

    @Column(name = "decision_note", length = 1000)
    private String decisionNote;

    @Column(name = "submitted_at")
    private OffsetDateTime submittedAt;

    @Column(name = "reviewed_at")
    private OffsetDateTime reviewedAt;

    @Column(name = "executed_at")
    private OffsetDateTime executedAt;

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
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
