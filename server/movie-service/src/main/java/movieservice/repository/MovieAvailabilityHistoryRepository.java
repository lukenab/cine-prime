package movieservice.repository;

import movieservice.entity.MovieAvailabilityHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MovieAvailabilityHistoryRepository extends JpaRepository<MovieAvailabilityHistory, Long> {
    List<MovieAvailabilityHistory> findByAvailabilityIdOrderByCreatedAtDesc(Long availabilityId);
}
