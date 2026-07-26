package movieservice.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import movieservice.enums.OptimizerMode;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;

/**
 * Create/update payload for {@code ShowtimeAllocationPolicy}. All the fields the CP-SAT/Legacy
 * optimizers actually read (see CpSatScheduleOptimizer#configureSolver and
 * AutoShowtimeCandidateScorer) are editable here - previously these only existed as DB columns
 * with no API to change them.
 */
public record ShowtimeAllocationPolicyRequest(
        @NotBlank
        String policyCode,

        @NotNull
        BigDecimal peakDemandWeight,

        @NotNull
        BigDecimal movieDemandWeight,

        @NotNull
        BigDecimal clusterDemandWeight,

        @NotNull
        BigDecimal timeSlotDemandWeight,

        @NotNull
        BigDecimal formatDemandWeight,

        @NotNull
        BigDecimal roomCapacityWeight,

        @NotNull
        @PositiveOrZero
        Integer minimumCoverage,

        @NotNull
        BigDecimal maximumRoomShare,

        @NotNull
        @PositiveOrZero
        Integer planningHorizonStartDays,

        @NotNull
        @PositiveOrZero
        Integer planningHorizonEndDays,

        @NotNull
        @PositiveOrZero
        Integer cleanupBufferMinutes,

        @NotNull
        @Positive
        Integer timeSlotIntervalMinutes,

        @NotNull
        @PositiveOrZero
        Integer sameMovieStaggerMinutes,

        @NotNull
        @Positive
        Integer maxSolveTimeSeconds,

        Integer solverRandomSeed,

        @NotNull
        @Positive
        Integer solverSearchWorkers,

        BigDecimal solverRelativeGap,

        Boolean solverLogSearchProgress,

        /** Null/0 means "no cap" - see ShowtimeAllocationPolicy#maxCandidatesPerMoviePerDay. */
        Integer maxCandidatesPerMoviePerDay,

        Boolean optimizerFallbackToLegacyOnError,

        @NotNull
        OptimizerMode defaultOptimizerMode,

        @NotBlank
        String businessTimezone,

        @NotNull
        LocalTime peakStartTime,

        @NotNull
        LocalTime peakEndTime,

        Boolean active,

        /** Full replacement list - update() deletes existing rows for this policy and re-inserts these. */
        @Valid
        List<ShowtimeAllocationFormatPriorityRequest> formatPriorities,

        /** Full replacement list, same semantics as formatPriorities above. Typically 4 rows
         *  (MORNING/AFTERNOON/EVENING/LATE_NIGHT) but not enforced - a policy can have a subset
         *  or none, in which case the scheduling engine falls back to its own defaults. */
        @Valid
        List<ShowtimeDaypartPolicyRequest> daypartPolicies
) {
}
