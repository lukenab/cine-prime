package promotionservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import promotionservice.entity.PromotionAuditLog;
import java.util.List;
import java.util.UUID;

public interface PromotionAuditLogRepository extends JpaRepository<PromotionAuditLog, UUID> {
    List<PromotionAuditLog> findTop20ByPromotion_PromotionIdOrderByCreatedAtDesc(UUID promotionId);
}
