package movieservice.repository;

import movieservice.entity.AuditoriumClass;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AuditoriumClassRepository extends JpaRepository<AuditoriumClass, Integer> {
    List<AuditoriumClass> findByActiveTrue();
}
