package movieservice.service.autoshowtime.optimizer.cpsat;

import com.google.ortools.sat.CpModel;

import java.util.List;

/** The built model plus the per-candidate variables, in the same order as the input candidates. */
public record CpSatModel(CpModel model, List<CandidateVar> candidateVars) {
}
