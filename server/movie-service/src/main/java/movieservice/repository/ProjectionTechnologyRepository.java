package movieservice.repository;

import movieservice.entity.ProjectionTechnology;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProjectionTechnologyRepository extends JpaRepository<ProjectionTechnology, Integer> {
    List<ProjectionTechnology> findByActiveTrue();
}
