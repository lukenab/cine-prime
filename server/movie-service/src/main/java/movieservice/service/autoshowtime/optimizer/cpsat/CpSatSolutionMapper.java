package movieservice.service.autoshowtime.optimizer.cpsat;

import com.google.ortools.sat.CpSolver;
import movieservice.enums.GenerationSkipReason;
import movieservice.service.autoshowtime.AutoShowtimeCandidateRejection;
import movieservice.service.autoshowtime.AutoShowtimeSelectionResult;
import movieservice.service.autoshowtime.ShowtimeCandidate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/** Reads solved BoolVar values back into the same selected/rejected shape the legacy selector produces. */
@Component
public class CpSatSolutionMapper {

    public AutoShowtimeSelectionResult mapSolution(CpSatModel built, CpSolver solver) {
        List<ShowtimeCandidate> selected = new ArrayList<>();
        List<AutoShowtimeCandidateRejection> rejected = new ArrayList<>();

        for (CandidateVar var : built.candidateVars()) {
            boolean isSelected = Boolean.TRUE.equals(solver.booleanValue(var.presence()));
            if (isSelected) {
                selected.add(var.candidate());
            } else {
                rejected.add(new AutoShowtimeCandidateRejection(
                        var.candidate(),
                        GenerationSkipReason.OPTIMIZER_NOT_SELECTED,
                        "CP-SAT's weekly-optimal solution did not select this candidate."));
            }
        }

        return new AutoShowtimeSelectionResult(selected, rejected);
    }
}
