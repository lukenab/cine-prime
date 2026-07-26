package movieservice.enums;

/**
 * Mirrors com.google.ortools.sat.CpSolverStatus so the rest of the codebase never imports
 * OR-Tools types directly (controllers/DTOs must not leak raw OR-Tools objects). UNKNOWN must
 * never be treated as an optimal result; a FEASIBLE result may still create a draft but must
 * expose that optimality was not proven; an INFEASIBLE result must not silently produce an
 * empty schedule reported as success. LEGACY runs are always FEASIBLE (the greedy algorithm
 * never proves optimality and never proves infeasibility either).
 */
public enum SolverStatus {
    OPTIMAL,
    FEASIBLE,
    INFEASIBLE,
    MODEL_INVALID,
    UNKNOWN
}
