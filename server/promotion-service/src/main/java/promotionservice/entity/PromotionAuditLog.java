package promotionservice.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.type.SqlTypes;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "promotion_audit_log")
@Getter @Setter @NoArgsConstructor
public class PromotionAuditLog {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "promotion_audit_log_id")
    private UUID promotionAuditLogId;
    @ManyToOne @JoinColumn(name = "promotion_id", nullable = false)
    private Promotion promotion;
    @Column(nullable = false, length = 40)
    private String action;
    private String actorAccountId;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> detail;
    @CreationTimestamp
    @Column(updatable = false)
    private OffsetDateTime createdAt;
}
