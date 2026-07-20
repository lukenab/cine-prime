package movieservice.repository;

import movieservice.entity.Resolution;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ResolutionRepository extends JpaRepository<Resolution, Integer> {
    List<Resolution> findByActiveTrue();
}
