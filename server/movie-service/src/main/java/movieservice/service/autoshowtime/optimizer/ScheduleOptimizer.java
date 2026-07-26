package movieservice.service.autoshowtime.optimizer;

import movieservice.entity.ShowtimeGenerationRun;
import movieservice.service.autoshowtime.ShowtimeCandidate;

import java.util.List;

/**
 * Boundary between business services and the optimization implementation. Neither OR-Tools nor
 * the legacy greedy algorithm's internals are visible past this interface - AutoShowtimeRunExecutor
 * depends only on this and {@link ScheduleOptimizationResult}.
 *
 * <p>Implementations receive the already-pruned raw candidate list from
 * {@link movieservice.service.autoshowtime.AutoShowtimeCandidateFactory} (hard eligibility,
 * operating hours, room-format capability, maintenance and existing-showtime conflicts already
 * removed) - they must not re-derive eligibility themselves, only decide which of the given
 * candidates to select and how to score/rank them.
 */
public interface ScheduleOptimizer {
    ScheduleOptimizationResult optimize(ShowtimeGenerationRun run, List<ShowtimeCandidate> rawCandidates);
}
