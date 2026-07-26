package bookingservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(name = "ticket_check_in", uniqueConstraints = {
        @UniqueConstraint(name = "uk_check_in_scope_key", columnNames = {"caller_scope", "idempotency_key"})
}, indexes = {
        @Index(name = "idx_check_in_ticket_time", columnList = "ticket_id,checked_in_at")
})
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TicketCheckIn {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "check_in_id", length = 50)
    String checkInId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ticket_id", nullable = false)
    Ticket ticket;

    @Column(name = "caller_scope", length = 100, nullable = false)
    String callerScope;

    @Column(name = "idempotency_key", length = 100, nullable = false)
    String idempotencyKey;

    @Column(name = "request_hash", length = 128, nullable = false)
    String requestHash;

    @Column(name = "check_in_mode", length = 20, nullable = false)
    String checkInMode;

    @Column(name = "gate_id", length = 50, nullable = false)
    String gateCode;

    @Column(name = "checked_by", length = 50, nullable = false)
    String checkedBy;

    @Column(name = "device_id", length = 100)
    String deviceId;

    @Column(name = "result", length = 30, nullable = false)
    String result;

    @Column(name = "checked_in_at", nullable = false)
    OffsetDateTime scannedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    OffsetDateTime createdAt;
}
