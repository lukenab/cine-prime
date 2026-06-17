package userservice.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "audit_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "entity_name")
    private String entityName;

    @Column(name = "entity_id")
    private String entityId;

    @Column
    private String action;

    @Column(columnDefinition = "TEXT", name = "old_value")
    private String oldValue;

    @Column(columnDefinition = "TEXT", name = "new_value")
    private String newValue;

    @Column(name = "perform_by")
    private String performBy;

    @Column(name = "perform_at")
    private LocalDateTime performAt;
}
