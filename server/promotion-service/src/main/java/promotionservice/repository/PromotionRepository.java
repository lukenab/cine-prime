package promotionservice.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import promotionservice.entity.Promotion;
import promotionservice.enums.PromotionStatus;

import java.util.UUID;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.List;

public interface PromotionRepository extends JpaRepository<Promotion, UUID> {
    boolean existsByCodeIgnoreCase(String code);

    Optional<Promotion> findByCodeIgnoreCase(String code);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Promotion p where p.promotionId = :id")
    Optional<Promotion> findByIdForUpdate(UUID id);

    Page<Promotion> findByStatus(PromotionStatus status, Pageable pageable);

    List<Promotion> findByStatusOrderByValidUntilAsc(PromotionStatus status);
}
