package movieservice.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import movieservice.enums.OptimizationScenario;
import movieservice.enums.OptimizerMode;

import java.time.LocalDate;
import java.util.List;

public record AutoShowtimeGenerationRequest (
    @NotNull
    LocalDate startDate,

    @NotNull
    LocalDate endDate,

    @NotEmpty
    List<Long> cinemaClusterIds,

    @NotEmpty
    List<Long> movieIds,

    /** Null defaults to the policy's configured default_optimizer_mode (LEGACY unless set otherwise). */
    OptimizerMode optimizer,

    /** Null defaults to BALANCED. Ignored entirely when optimizer is LEGACY. */
    OptimizationScenario scenario,

    /**
     * Rolling replanning (P2) is not implemented yet - this field exists so the request contract
     * matches the target API shape, but a request with replanMode=true is rejected rather than
     * silently treated as a normal fresh-generation run.
     */
    Boolean replanMode,

    /**
     * Rooms to exclude from candidate generation for this run only (e.g. held for a private
     * booking, or under short-notice maintenance not yet reflected in room status). Optional -
     * null or empty means the optimizer considers every eligible room as usual. Any id that does
     * not belong to one of {@link #cinemaClusterIds} is silently ignored rather than rejected,
     * since the frontend only offers rooms from the selected clusters but scope can change
     * between page load and submit.
     */
    List<Long> excludedRoomIds
){
}
