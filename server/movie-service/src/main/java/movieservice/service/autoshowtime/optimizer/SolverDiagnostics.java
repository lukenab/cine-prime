package movieservice.service.autoshowtime.optimizer;

import java.util.Map;

/**
 * Reported to the API so an admin (or a shadow-compare report) can see why a run produced what
 * it did without reading server logs. prunedByReason keys are {@link movieservice.enums.GenerationSkipReason}
 * names - kept as strings here so this record doesn't need to change if that enum grows.
 */
public record SolverDiagnostics(
        int rawCandidateCount,
        int eligibleCandidateCount,
        Map<String, Integer> prunedByReason,
        int variablesCreated,
        int intervalVariablesCreated,
        int constraintCount,
        long solveDurationMillis,
        boolean optimalityProven
) {
    public static SolverDiagnostics legacy(int rawCandidateCount, int eligibleCandidateCount,
            Map<String, Integer> prunedByReason, long solveDurationMillis) {
        return new SolverDiagnostics(rawCandidateCount, eligibleCandidateCount, prunedByReason,
                0, 0, 0, solveDurationMillis, false);
    }
}
