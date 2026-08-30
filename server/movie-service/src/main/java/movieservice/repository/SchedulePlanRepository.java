package movieservice.repository;

import jakarta.persistence.LockModeType;
import movieservice.entity.SchedulePlan;
import movieservice.dto.response.SchedulePlanSummaryResponse;
import movieservice.enums.SchedulePlanStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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

    @Query(
            value = """
                    SELECT new movieservice.dto.response.SchedulePlanSummaryResponse(
                        plan.schedulePlanId,
                        run.generationRunId,
                        plan.status,
                        plan.blockerCount,
                        run.startDate,
                        run.endDate,
                        run.requestedBy,
                        COUNT(DISTINCT slot.schedulePlanSlotId),
                        COUNT(DISTINCT room.cinemaRoomId),
                        COUNT(DISTINCT cluster.clusterId),
                        plan.createdAt,
                        plan.updatedAt,
                        plan.submittedAt,
                        plan.approvedAt,
                        plan.publishedAt
                    )
                    FROM SchedulePlan plan
                    JOIN plan.generationRun run
                    LEFT JOIN plan.slots slot
                    LEFT JOIN slot.cinemaRoom room
                    LEFT JOIN room.cluster cluster
                    WHERE (:status IS NULL OR plan.status = :status)
                    GROUP BY
                        plan.schedulePlanId,
                        run.generationRunId,
                        plan.status,
                        plan.blockerCount,
                        run.startDate,
                        run.endDate,
                        run.requestedBy,
                        plan.createdAt,
                        plan.updatedAt,
                        plan.submittedAt,
                        plan.approvedAt,
                        plan.publishedAt
                    ORDER BY plan.updatedAt DESC
                    """,
            countQuery = """
                    SELECT COUNT(plan)
                    FROM SchedulePlan plan
                    WHERE (:status IS NULL OR plan.status = :status)
                    """
    )
    Page<SchedulePlanSummaryResponse> findSummaries(
            @Param("status") SchedulePlanStatus status,
            Pageable pageable);
}

