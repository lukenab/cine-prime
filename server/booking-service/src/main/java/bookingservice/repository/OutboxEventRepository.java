package bookingservice.repository;

import bookingservice.entity.OutboxEvent;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface OutboxEventRepository extends JpaRepository<OutboxEvent, String> {
    @Query("""
            select e
              from OutboxEvent e
             where e.status in :statuses
               and (e.nextAttemptAt is null or e.nextAttemptAt <= :now)
             order by e.occurredAt asc
            """)
    List<OutboxEvent> findDue(
            @Param("statuses") Collection<String> statuses,
            @Param("now") OffsetDateTime now);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from OutboxEvent e where e.eventId = :eventId")
    Optional<OutboxEvent> findByIdForUpdate(@Param("eventId") String eventId);
}
