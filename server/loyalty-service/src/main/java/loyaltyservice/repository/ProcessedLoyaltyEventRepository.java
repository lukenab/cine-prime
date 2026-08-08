package loyaltyservice.repository;

import loyaltyservice.entity.ProcessedLoyaltyEvent;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProcessedLoyaltyEventRepository extends JpaRepository<ProcessedLoyaltyEvent, String> {
}
