package analyticsservice.repository;

import analyticsservice.entity.ProcessedEvent;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProcessedEventRepository extends JpaRepository<ProcessedEvent, String> {
    boolean existsBySourceEventId(String sourceEventId);
}
