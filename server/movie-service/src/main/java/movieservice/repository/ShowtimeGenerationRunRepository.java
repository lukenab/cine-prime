package movieservice.repository;

import movieservice.entity.ShowtimeGenerationRun;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.persistence.LockModeType;
import movieservice.enums.GenerationRunStatus;
import java.util.List;
import java.util.Optional;

@Repository
public interface ShowtimeGenerationRunRepository extends JpaRepository<ShowtimeGenerationRun, Long>{
    Optional<ShowtimeGenerationRun> findByIdempotencyKey(String idempotencyKey);

    @EntityGraph(attributePaths = {"policy", "movies", "clusters"})
    Optional<ShowtimeGenerationRun> findByGenerationRunId(Long generationRunId);

    /// Lock run khi executor claim để nhiều instance scheduler không cùng execute một run.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT run
            FROM ShowtimeGenerationRun run
            WHERE run.generationRunId = :generationRunId
            """)
    Optional<ShowtimeGenerationRun> findByGenerationRunIdForUpdate(
            @Param("generationRunId") Long generationRunId
    );

    /// Scheduler chỉ lấy một batch nhỏ run đang chờ để không giữ transaction quá lâu.
    List<ShowtimeGenerationRun> findTop20ByStatusOrderByCreatedAtAsc(GenerationRunStatus status);
}
