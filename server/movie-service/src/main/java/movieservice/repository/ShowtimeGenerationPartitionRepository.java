package movieservice.repository;

import movieservice.entity.ShowtimeGenerationPartition;
import movieservice.enums.GenerationPartitionStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ShowtimeGenerationPartitionRepository extends JpaRepository<ShowtimeGenerationPartition, Long> {
    Optional<ShowtimeGenerationPartition> findByGenerationRun_GenerationRunIdAndClusterIdAndBusinessDate(
            Long runId, Long clusterId, LocalDate businessDate);
    List<ShowtimeGenerationPartition> findByGenerationRun_GenerationRunId(Long runId);
    long countByGenerationRun_GenerationRunIdAndStatus(Long runId, GenerationPartitionStatus status);
}
