package movieservice.service.autoshowtime.optimizer.cpsat;

import com.google.ortools.sat.LinearArgument;
import com.google.ortools.sat.LinearExpr;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/**
 * Builds the MILP objective from each candidate's already-computed {@code score} (the same
 * weighted demand/cluster/daypart/format/capacity-fit sum the legacy scorer produces - CP-SAT's
 * value-add is joint weekly selection, not a different demand model) plus a penalty for
 * under-covering a movie/cluster's soft weekly target.
 *
 * <p>CP-SAT requires integer coefficients (P1 §5), so every BigDecimal score is scaled by
 * {@link #SCALE} and rounded before use. Gap and schedule-stability penalties are deliberately
 * <b>not</b> folded in here - see ObjectiveBreakdown's javadoc for why - they're reported as
 * post-solve diagnostics instead so this MILP stays a linear objective over existing decision
 * variables rather than needing additional slack/auxiliary variables per room per day.
 */
@Component
public class CpSatObjectiveBuilder {

    private static final long SCALE = 1_000_000L;

    public void buildObjective(CpSatModel built, List<CpSatConstraintFactory.CoverageShortfall> shortfalls,
            double shortfallPenaltyWeight) {
        List<LinearArgument> terms = new ArrayList<>();
        List<Long> coefficients = new ArrayList<>();

        for (CandidateVar var : built.candidateVars()) {
            BigDecimal score = var.candidate().getScore() == null ? BigDecimal.ZERO : var.candidate().getScore();
            long coefficient = score.multiply(BigDecimal.valueOf(SCALE)).setScale(0, RoundingMode.HALF_UP).longValueExact();
            if (coefficient == 0) {
                continue;
            }
            terms.add(var.presence());
            coefficients.add(coefficient);
        }

        long penaltyCoefficient = Math.round(shortfallPenaltyWeight * SCALE);
        for (CpSatConstraintFactory.CoverageShortfall shortfall : shortfalls) {
            if (penaltyCoefficient == 0) continue;
            terms.add(shortfall.shortfall());
            coefficients.add(-penaltyCoefficient);
        }

        long[] coefficientArray = new long[coefficients.size()];
        for (int i = 0; i < coefficientArray.length; i++) {
            coefficientArray[i] = coefficients.get(i);
        }

        built.model().maximize(LinearExpr.weightedSum(terms.toArray(new LinearArgument[0]), coefficientArray));
    }

    public static long scale() {
        return SCALE;
    }
}
