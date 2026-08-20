package workforceservice.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import workforceservice.entity.WorkforceOutboxEvent;
import java.time.OffsetDateTime;
import java.util.*;

public interface WorkforceOutboxRepository extends JpaRepository<WorkforceOutboxEvent, String> {
    @Query("""
            select e.eventId from WorkforceOutboxEvent e
            where e.publishStatus in :statuses
              and (e.nextAttemptAt is null or e.nextAttemptAt <= :now)
            order by e.occurredAt
            """)
    List<String> findDueIds(@Param("statuses") Collection<String> statuses,
                            @Param("now") OffsetDateTime now,
                            Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from WorkforceOutboxEvent e where e.eventId = :eventId")
    Optional<WorkforceOutboxEvent> findByIdForUpdate(@Param("eventId") String eventId);
}
