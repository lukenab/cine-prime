package bookingservice.repository;

import bookingservice.entity.BookingReconciliation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookingReconciliationRepository extends JpaRepository<BookingReconciliation, String> {
    boolean existsByIdempotencyKey(String idempotencyKey);

    @EntityGraph(attributePaths = "booking")
    Page<BookingReconciliation> findByClusterIdOrderByCreatedAtDesc(
            Long clusterId,
            Pageable pageable);
}
