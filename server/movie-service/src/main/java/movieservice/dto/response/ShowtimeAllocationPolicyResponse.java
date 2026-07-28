package movieservice.dto.response;

import movieservice.enums.OptimizerMode;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

/** Full admin view of a {@code ShowtimeAllocationPolicy} row, including its format priorities. */
public record ShowtimeAllocationPolicyResponse(
        Long policyId,
        String policyCode,
        Boolean active,
        BigDecimal peakDemandWeight,
        BigDecimal movieDemandWeight,
        BigDecimal clusterDemandWeight,
        BigDecimal timeSlotDemandWeight,
        BigDecimal formatDemandWeight,
        BigDecimal roomCapacityWeight,
        Integer minimumCoverage,
        BigDecimal maximumRoomShare,
        Integer planningHorizonStartDays,
        Integer planningHorizonEndDays,
        Integer cleanupBufferMinutes,
        Integer timeSlotIntervalMinutes,
        Integer sameMovieStaggerMinutes,
        Integer maxSolveTimeSeconds,
        Integer solverRandomSeed,
        Integer solverSearchWorkers,
        BigDecimal solverRelativeGap,
        Boolean solverLogSearchProgress,
        Integer maxCandidatesPerMoviePerDay,
        Boolean optimizerFallbackToLegacyOnError,
        OptimizerMode defaultOptimizerMode,
        String businessTimezone,
        LocalTime peakStartTime,
        LocalTime peakEndTime,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        String createdBy,
        String updatedBy,
        List<ShowtimeAllocationFormatPriorityResponse> formatPriorities,
        List<ShowtimeDaypartPolicyResponse> daypartPolicies
) {
}
