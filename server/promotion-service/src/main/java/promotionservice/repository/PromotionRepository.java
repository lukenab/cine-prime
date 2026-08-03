package promotionservice.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import promotionservice.entity.Promotion;
import promotionservice.enums.PromotionStatus;

import java.util.UUID;

public interface PromotionRepository extends JpaRepository<Promotion, UUID> {
    boolean existsByCodeIgnoreCase(String code);

    Page<Promotion> findByStatus(PromotionStatus status, Pageable pageable);
}
