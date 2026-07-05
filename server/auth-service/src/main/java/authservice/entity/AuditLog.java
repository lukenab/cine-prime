package authservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "auth_audit_log")
@AllArgsConstructor @NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Getter @Setter @Builder
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "audit_id", updatable = false, nullable = false, length = 36)
    String auditId;

    @Column(name = "actor_account_id", length = 36)
    String actorAccountId;

    @Column(name = "target_account_id", length = 36)
    String targetAccountId;

    @Column(name = "action", nullable = false, length = 100)
    String action;

    @Column(name = "status", nullable = false, length = 20)
    String status;

    @Column(name = "message", columnDefinition = "TEXT")
    String message;

    @Column(name = "ip_address", length = 50)
    String ipAddress;

    @Column(name = "user_agent", columnDefinition = "TEXT")
    String userAgent;

    @Column(name = "metadata", columnDefinition = "TEXT")
    String metadata;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    LocalDateTime createdAt;


}
