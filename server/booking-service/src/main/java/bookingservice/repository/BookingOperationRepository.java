package bookingservice.repository;

import bookingservice.entity.IdempotencyRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface BookingOperationRepository extends JpaRepository<IdempotencyRecord, String> {
    Optional<IdempotencyRecord> findByCallerScopeAndOperationScopeAndIdempotencyKey(
            String callerScope, String operationScope, String idempotencyKey);
}
