package promotionservice.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import promotionservice.entity.PromotionReservation;
import promotionservice.enums.PromotionReservationStatus;

import java.util.Collection;
import java.util.Optional;
import java.util.UUID;

public interface PromotionReservationRepository extends JpaRepository<PromotionReservation, UUID> {
    Optional<PromotionReservation> findByIdempotencyKey(String idempotencyKey);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from PromotionReservation r where r.promotionReservationId = :id")
    Optional<PromotionReservation> findByIdForUpdate(UUID id);

    long countByPromotionPromotionIdAndAccountIdAndStatusIn(UUID promotionId, String accountId,
                                                            Collection<PromotionReservationStatus> statuses);
}
