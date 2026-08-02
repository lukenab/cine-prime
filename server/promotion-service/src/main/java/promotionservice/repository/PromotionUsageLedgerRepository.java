package promotionservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import promotionservice.entity.PromotionUsageLedger;

import java.util.UUID;

public interface PromotionUsageLedgerRepository extends JpaRepository<PromotionUsageLedger, UUID> {}
