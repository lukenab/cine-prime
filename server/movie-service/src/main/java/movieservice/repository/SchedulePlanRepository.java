package movieservice.repository;

import jakarta.persistence.LockModeType;
import movieservice.entity.SchedulePlan;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface SchedulePlanRepository extends JpaRepository<SchedulePlan, Long> {
    Optional<SchedulePlan> findByGenerationRun_GenerationRunId(Long generationRunId);

    @EntityGraph(attributePaths = {
            "generationRun", "slots", "slots.movie", "slots.cinemaRoom",
            "slots.cinemaRoom.cluster", "slots.screeningVersion", "slots.screeningVersion.format"
    })
    @Query("SELECT plan FROM SchedulePlan plan WHERE plan.schedulePlanId = :planId")
    Optional<SchedulePlan> findDetailedById(@Param("planId") Long planId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT plan FROM SchedulePlan plan WHERE plan.schedulePlanId = :planId")
    Optional<SchedulePlan> findByIdForUpdate(@Param("planId") Long planId);
}

