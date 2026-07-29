package bookingservice.repository;

import bookingservice.entity.CompensationTask;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface CompensationTaskRepository extends JpaRepository<CompensationTask, String> {
    boolean existsByIdempotencyKey(String idempotencyKey);

    @Query("""
            select t
              from CompensationTask t
             where t.status in :statuses
               and (t.nextAttemptAt is null or t.nextAttemptAt <= :now)
             order by t.createdAt asc
            """)
    List<CompensationTask> findDue(
            @Param("statuses") Collection<String> statuses,
            @Param("now") OffsetDateTime now);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from CompensationTask t where t.taskId = :taskId")
    Optional<CompensationTask> findByIdForUpdate(@Param("taskId") String taskId);
}
