package bookingservice.repository;

import bookingservice.entity.CompensationTask;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CompensationTaskRepository extends JpaRepository<CompensationTask, String> {
}
