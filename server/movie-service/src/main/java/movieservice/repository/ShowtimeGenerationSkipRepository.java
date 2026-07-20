package movieservice.repository;

import movieservice.entity.ShowtimeGenerationSkip;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ShowtimeGenerationSkipRepository extends JpaRepository<ShowtimeGenerationSkip, Long> {

    /// Lấy các candidate bị skip theo đúng thứ tự audit để trả về kết quả generation run.
    List<ShowtimeGenerationSkip> findByGenerationRun_GenerationRunIdOrderByCreatedAtAsc(Long generationRunId);
}
