package movieservice.repository;

import movieservice.entity.RoomConfigurationTemplate;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RoomConfigurationTemplateRepository extends JpaRepository<RoomConfigurationTemplate, Integer> {
    @EntityGraph(attributePaths = {"auditoriumClass", "projectionTechnology", "resolution", "audioFormat"})
    List<RoomConfigurationTemplate> findByActiveTrueOrderByDisplayOrderAscTemplateNameAsc();
}
