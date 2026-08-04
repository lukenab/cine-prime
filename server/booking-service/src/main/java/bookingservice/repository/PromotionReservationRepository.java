package bookingservice.repository;

import bookingservice.entity.PromotionReservation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PromotionReservationRepository extends JpaRepository<PromotionReservation, String> {
    Optional<PromotionReservation> findByExternalReservationId(String externalReservationId);
}
