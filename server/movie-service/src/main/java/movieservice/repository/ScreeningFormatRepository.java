package movieservice.repository;

import movieservice.entity.ScreeningFormat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ScreeningFormatRepository extends JpaRepository<ScreeningFormat, Integer> {
    Optional<ScreeningFormat> findByFormatCode(String formatCode);
    List<ScreeningFormat> findAllByFormatIdIn(List<Integer> ids);
}
