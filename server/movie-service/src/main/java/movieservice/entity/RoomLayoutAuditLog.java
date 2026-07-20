package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.RoomLayoutAction;

import java.time.LocalDateTime;

@Entity
@Table(name = "room_layout_audit_log")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RoomLayoutAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "log_id", length = 36)
    String logId;

    @Column(name = "room_layout_id", nullable = false)
    Long roomLayoutId;

    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false, length = 20)
    RoomLayoutAction action;

    @Column(name = "performed_by", length = 255)
    String performedBy;

    @Column(name = "old_status", length = 20)
    String oldStatus;

    @Column(name = "new_status", length = 20)
    String newStatus;

    @Column(name = "note", columnDefinition = "TEXT")
    String note;

    @Column(name = "timestamp", nullable = false)
    LocalDateTime timestamp;
}
