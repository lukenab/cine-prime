package movieservice.service.autoshowtime.optimizer.cpsat;

import com.google.ortools.sat.BoolVar;
import com.google.ortools.sat.CpModel;
import com.google.ortools.sat.IntervalVar;
import com.google.ortools.sat.LinearExpr;
import movieservice.service.autoshowtime.ShowtimeCandidate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

/**
 * Creates exactly one binary decision variable x[movie, version, room, businessDate, startSlot]
 * per already-pruned {@link ShowtimeCandidate} - never the full Cartesian product, since the
 * candidates list handed in already went through
 * {@link movieservice.service.autoshowtime.AutoShowtimeCandidateFactory}'s eligibility pruning.
 * Each variable is backed by an optional IntervalVar so room-occupancy constraints (NoOverlap,
 * Cumulative) can use OR-Tools' native interval-overlap reasoning instead of a hand-rolled time
 * grid. Times are converted to integer minutes since a shared UTC epoch (the run's start date
 * minus one day) - using each candidate's absolute instant rather than any single cluster's local
 * time keeps ordering/overlap comparisons correct even when a run spans clusters in different
 * timezones, since IntervalVar/NoOverlap/Cumulative are only ever applied within groups that
 * share one room (and therefore one cluster/timezone) - see CpSatConstraintFactory.
 */
@Component
public class CpSatModelBuilder {

    public CpSatModel build(LocalDate runStartDate, List<ShowtimeCandidate> candidates) {
        CpModel model = new CpModel();
        OffsetDateTime epoch = runStartDate.minusDays(1).atStartOfDay(ZoneOffset.UTC).toOffsetDateTime();

        List<CandidateVar> candidateVars = new ArrayList<>(candidates.size());
        for (int index = 0; index < candidates.size(); index++) {
            ShowtimeCandidate candidate = candidates.get(index);
            long startMinutes = Duration.between(epoch, candidate.temporalStartAt()).toMinutes();
            long endMinutes = Duration.between(epoch, candidate.temporalEndAt()).toMinutes();
            long sizeMinutes = endMinutes - startMinutes;

            String suffix = "_" + index;
            BoolVar presence = model.newBoolVar("x" + suffix);
            IntervalVar interval = model.newOptionalIntervalVar(
                    LinearExpr.constant(startMinutes),
                    LinearExpr.constant(sizeMinutes),
                    LinearExpr.constant(endMinutes),
                    presence,
                    "interval" + suffix);

            candidateVars.add(new CandidateVar(candidate, presence, interval, startMinutes, endMinutes));
        }

        return new CpSatModel(model, candidateVars);
    }
}
