package movieservice.service.autoshowtime.optimizer;

import movieservice.service.autoshowtime.ShowtimeCandidate;
import movieservice.service.autoshowtime.ShowtimeScoreBreakdown;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Shared by both optimizers so SHADOW_COMPARE diagnostics compare like-for-like numbers instead
 * of two implementations computing "demand score" differently. Sums each selected candidate's
 * already-computed {@link ShowtimeScoreBreakdown} (itself 0..1-normalized per component before
 * policy weighting) rather than re-deriving anything from raw policy/profile data.
 */
final class ObjectiveBreakdownFactory {

    private ObjectiveBreakdownFactory() {
    }

    static ObjectiveBreakdown fromSelected(List<ShowtimeCandidate> selected, BigDecimal finalWeightedScore,
            BigDecimal stabilityPenalty, BigDecimal gapPenalty) {
        if (selected.isEmpty()) {
            return ObjectiveBreakdown.empty();
        }

        BigDecimal demand = BigDecimal.ZERO;
        BigDecimal utilization = BigDecimal.ZERO;
        BigDecimal revenue = BigDecimal.ZERO;
        BigDecimal primeTime = BigDecimal.ZERO;

        for (ShowtimeCandidate candidate : selected) {
            ShowtimeScoreBreakdown breakdown = candidate.getScoreBreakdown();
            if (breakdown == null) {
                continue;
            }
            demand = demand.add(nullToZero(breakdown.movieDemandScore()));
            utilization = utilization.add(nullToZero(breakdown.capacityFitScore()));
            primeTime = primeTime.add(nullToZero(breakdown.timeDemandScore()));
            revenue = revenue.add(BigDecimal.valueOf(
                    breakdown.expectedAttendance() == null ? 0 : breakdown.expectedAttendance()));
        }

        Set<Long> distinctMovies = selected.stream().map(ShowtimeCandidate::getMovieId).collect(Collectors.toSet());
        BigDecimal diversity = BigDecimal.valueOf(distinctMovies.size())
                .divide(BigDecimal.valueOf(selected.size()), 4, RoundingMode.HALF_UP);

        return new ObjectiveBreakdown(demand, utilization, revenue, primeTime, diversity,
                stabilityPenalty, gapPenalty, finalWeightedScore);
    }

    private static BigDecimal nullToZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}
