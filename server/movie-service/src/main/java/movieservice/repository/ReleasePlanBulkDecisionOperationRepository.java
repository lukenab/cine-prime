package movieservice.repository;

import movieservice.entity.ReleasePlanBulkDecisionOperation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ReleasePlanBulkDecisionOperationRepository extends JpaRepository<ReleasePlanBulkDecisionOperation, Long> {
    /** Serializes concurrent retries for the same actor/key before an operation row exists. */
    @Query(value = "SELECT pg_advisory_xact_lock(hashtext(:actor), hashtext(:idempotencyKey))", nativeQuery = true)
    Object acquireIdempotencyLock(
            @Param("actor") String actor,
            @Param("idempotencyKey") String idempotencyKey);

    Optional<ReleasePlanBulkDecisionOperation> findByActorAndIdempotencyKey(String actor, String idempotencyKey);
}
