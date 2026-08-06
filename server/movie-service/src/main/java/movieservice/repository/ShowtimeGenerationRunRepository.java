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

    /**
     * Loads the complete immutable input snapshot needed by the asynchronous executor.
     * The executor intentionally does not keep one database transaction open while the
     * optimizer runs, so every collection it reads must be initialized at this boundary.
     */
    @EntityGraph(attributePaths = {
            "policy",
            "movies",
            "clusters",
            "excludedRooms",
            "screeningVersionOverrides",
            "screeningVersionOverrides.movie"
    })
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

    /// Run RUNNING quá lâu so với cutoff nghĩa là worker đã claim nó đã chết (ví dụ dev-server
    /// restart giữa chừng) mà không kịp gọi finish()/fail() - không có cơ chế nào khác từng phục
    /// hồi run ở trạng thái này (recovery scheduler ở trên chỉ xử lý ACCEPTED).
    List<ShowtimeGenerationRun> findTop20ByStatusAndStartedAtBeforeOrderByStartedAtAsc(
            GenerationRunStatus status, java.time.LocalDateTime cutoff);
}
