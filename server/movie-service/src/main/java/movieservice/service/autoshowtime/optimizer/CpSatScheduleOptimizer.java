package movieservice.service.autoshowtime.optimizer;

import com.google.ortools.sat.CpSolver;
import com.google.ortools.sat.CpSolverStatus;
import com.google.ortools.sat.SatParameters;
import lombok.RequiredArgsConstructor;
import movieservice.entity.CinemaClusterDemandProfile;
import movieservice.entity.ShowtimeAllocationPolicy;
import movieservice.entity.ShowtimeGenerationRun;
import movieservice.enums.GenerationSkipReason;
import movieservice.enums.SolverStatus;
import movieservice.repository.CinemaClusterDemandProfileRepository;
import movieservice.service.autoshowtime.AutoShowtimeCandidateRejection;
import movieservice.service.autoshowtime.AutoShowtimeCandidateScorer;
import movieservice.service.autoshowtime.AutoShowtimeSelectionResult;
import movieservice.service.autoshowtime.ShowtimeCandidate;
import movieservice.service.autoshowtime.optimizer.cpsat.CandidateVar;
import movieservice.service.autoshowtime.optimizer.cpsat.CpSatConstraintFactory;
import movieservice.service.autoshowtime.optimizer.cpsat.CpSatModel;
import movieservice.service.autoshowtime.optimizer.cpsat.CpSatModelBuilder;
import movieservice.service.autoshowtime.optimizer.cpsat.CpSatObjectiveBuilder;
import movieservice.service.autoshowtime.optimizer.cpsat.CpSatSolutionMapper;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Weekly CP-SAT optimizer (P1). Orchestrates: reuse the legacy scorer for per-candidate demand/
 * capacity scoring → prune candidates whose cluster has no demand profile (mirrors the legacy
 * selector's MISSING_DEMAND_PROFILE hard rule) → optionally cap candidates per (movie, cluster,
 * date) if the policy configures a pruning limit → build the CP-SAT model/constraints/objective
 * for the *entire* requested date range at once → solve → map the solution back into the same
 * {@link AutoShowtimeSelectionResult} shape the legacy path produces, so nothing downstream
 * (validation, partitioning, persistence) needs to know which optimizer ran.
 */
@Service
@RequiredArgsConstructor
public class CpSatScheduleOptimizer implements ScheduleOptimizer {

    private final AutoShowtimeCandidateScorer candidateScorer;
    private final CinemaClusterDemandProfileRepository demandProfileRepository;
    private final CpSatModelBuilder modelBuilder;
    private final CpSatConstraintFactory constraintFactory;
    private final CpSatObjectiveBuilder objectiveBuilder;
    private final CpSatSolutionMapper solutionMapper;

    @Override
    public ScheduleOptimizationResult optimize(ShowtimeGenerationRun run, List<ShowtimeCandidate> rawCandidates) {
        long startedAt = System.currentTimeMillis();
        ShowtimeAllocationPolicy policy = run.getPolicy();
        ScenarioParameters scenarioParameters = ScenarioParameters.forScenario(run.getScenario());

        List<ShowtimeCandidate> ranked = candidateScorer.scoreAndRank(run, rawCandidates);

        Map<Long, CinemaClusterDemandProfile> demandProfileByCluster = loadDemandProfiles(ranked);
        List<AutoShowtimeCandidateRejection> preRejected = new ArrayList<>();
        List<ShowtimeCandidate> eligible = new ArrayList<>();
        for (ShowtimeCandidate candidate : ranked) {
            if (!demandProfileByCluster.containsKey(candidate.getClusterId())) {
                preRejected.add(new AutoShowtimeCandidateRejection(candidate,
                        GenerationSkipReason.MISSING_DEMAND_PROFILE,
                        "Cinema cluster does not have a demand profile."));
            } else {
                eligible.add(candidate);
            }
        }

        List<ShowtimeCandidate> pruned = applyCandidateCap(eligible, policy, preRejected);

        if (pruned.isEmpty()) {
            return emptyResult(run, rawCandidates.size(), eligible.size(), preRejected, startedAt);
        }

        CpSatModel built = modelBuilder.build(run.getStartDate(), pruned);
        CpSatConstraintFactory.ConstraintBuildResult constraints = constraintFactory.addConstraints(
                built, policy, demandProfileByCluster,
                scenarioParameters.softTargetMultiplier(), scenarioParameters.roomShareMultiplier());
        objectiveBuilder.buildObjective(built, constraints.shortfalls(), scenarioParameters.shortfallPenaltyWeight());

        CpSolver solver = new CpSolver();
        configureSolver(solver, policy);
        CpSolverStatus status = solver.solve(built.model());
        long solveDurationMillis = System.currentTimeMillis() - startedAt;

        SolverStatus solverStatus = mapStatus(status);
        AutoShowtimeSelectionResult solverSelection = (solverStatus == SolverStatus.OPTIMAL || solverStatus == SolverStatus.FEASIBLE)
                ? solutionMapper.mapSolution(built, solver)
                : allRejectedAsInfeasible(built, solverStatus);

        List<ShowtimeCandidate> selected = solverSelection.selectedCandidates();
        List<AutoShowtimeCandidateRejection> allRejected = new ArrayList<>(preRejected);
        allRejected.addAll(solverSelection.rejectedCandidates());
        AutoShowtimeSelectionResult finalSelection = new AutoShowtimeSelectionResult(selected, allRejected);

        BigDecimal finalWeightedScore = (solverStatus == SolverStatus.OPTIMAL || solverStatus == SolverStatus.FEASIBLE)
                ? BigDecimal.valueOf(solver.objectiveValue()).divide(BigDecimal.valueOf(CpSatObjectiveBuilder.scale()), 4, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        BigDecimal gapPenalty = computeGapPenalty(selected);
        ObjectiveBreakdown objectiveBreakdown = ObjectiveBreakdownFactory.fromSelected(
                selected, finalWeightedScore, BigDecimal.ZERO, gapPenalty);

        Map<String, Integer> prunedByReason = new HashMap<>();
        for (AutoShowtimeCandidateRejection rejection : allRejected) {
            prunedByReason.merge(rejection.reason().name(), 1, Integer::sum);
        }
        SolverDiagnostics diagnostics = new SolverDiagnostics(
                rawCandidates.size(), eligible.size(), prunedByReason,
                built.candidateVars().size(), built.candidateVars().size(), constraints.constraintCount(),
                solveDurationMillis, solverStatus == SolverStatus.OPTIMAL);

        return new ScheduleOptimizationResult(finalSelection, solverStatus, objectiveBreakdown, diagnostics);
    }

    private Map<Long, CinemaClusterDemandProfile> loadDemandProfiles(List<ShowtimeCandidate> candidates) {
        Map<Long, CinemaClusterDemandProfile> result = new HashMap<>();
        for (ShowtimeCandidate candidate : candidates) {
            result.computeIfAbsent(candidate.getClusterId(),
                    clusterId -> demandProfileRepository.findByCluster_ClusterId(clusterId).orElse(null));
        }
        result.values().removeIf(java.util.Objects::isNull);
        return result;
    }

    /// Optional pruning: keep only the top-N highest-scoring candidates per (movie, cluster,
    /// date) when the policy configures a cap, so a very fine time-slot granularity doesn't
    /// blow up the variable count for movies/days that clearly don't need every 15-minute slot
    /// considered. Never applied unless the policy explicitly sets a positive cap.
    private List<ShowtimeCandidate> applyCandidateCap(
            List<ShowtimeCandidate> eligible, ShowtimeAllocationPolicy policy, List<AutoShowtimeCandidateRejection> rejectedOut) {
        Integer cap = policy.getMaxCandidatesPerMoviePerDay();
        if (cap == null || cap <= 0) {
            return eligible;
        }

        Map<String, List<ShowtimeCandidate>> byMovieClusterDay = new LinkedHashMap<>();
        for (ShowtimeCandidate candidate : eligible) {
            String key = candidate.getMovieId() + "|" + candidate.getClusterId() + "|" + candidate.getShowDate();
            byMovieClusterDay.computeIfAbsent(key, ignored -> new ArrayList<>()).add(candidate);
        }

        List<ShowtimeCandidate> kept = new ArrayList<>();
        for (List<ShowtimeCandidate> group : byMovieClusterDay.values()) {
            if (group.size() <= cap) {
                kept.addAll(group);
                continue;
            }
            List<ShowtimeCandidate> sorted = group.stream()
                    .sorted(Comparator.comparing(ShowtimeCandidate::getScore,
                            Comparator.nullsFirst(Comparator.naturalOrder())).reversed())
                    .toList();
            kept.addAll(sorted.subList(0, cap));
            for (ShowtimeCandidate dropped : sorted.subList(cap, sorted.size())) {
                rejectedOut.add(new AutoShowtimeCandidateRejection(dropped, GenerationSkipReason.NO_AVAILABLE_TIME_SLOT,
                        "Pruned before solving: exceeds max_candidates_per_movie_per_day (" + cap + ")."));
            }
        }
        return kept;
    }

    private void configureSolver(CpSolver solver, ShowtimeAllocationPolicy policy) {
        SatParameters.Builder params = solver.getParameters();
        params.setMaxTimeInSeconds(policy.getMaxSolveTimeSeconds() == null ? 30.0 : policy.getMaxSolveTimeSeconds());
        params.setRandomSeed(policy.getSolverRandomSeed() == null ? 42 : policy.getSolverRandomSeed());
        params.setNumSearchWorkers(policy.getSolverSearchWorkers() == null ? 8 : policy.getSolverSearchWorkers());
        if (policy.getSolverRelativeGap() != null && policy.getSolverRelativeGap().compareTo(BigDecimal.ZERO) > 0) {
            params.setRelativeGapLimit(policy.getSolverRelativeGap().doubleValue());
        }
        params.setLogSearchProgress(Boolean.TRUE.equals(policy.getSolverLogSearchProgress()));
    }

    private SolverStatus mapStatus(CpSolverStatus status) {
        return switch (status) {
            case OPTIMAL -> SolverStatus.OPTIMAL;
            case FEASIBLE -> SolverStatus.FEASIBLE;
            case INFEASIBLE -> SolverStatus.INFEASIBLE;
            case MODEL_INVALID -> SolverStatus.MODEL_INVALID;
            default -> SolverStatus.UNKNOWN;
        };
    }

    /// INFEASIBLE/MODEL_INVALID/UNKNOWN must never silently produce an empty schedule reported
    /// as success - every candidate is explicitly rejected with the solver status as the reason,
    /// and the caller (AutoShowtimeRunExecutor) already treats a fully-empty selection as
    /// NO_USABLE_PARTITION, a technical failure, not a quiet zero-slot success.
    private AutoShowtimeSelectionResult allRejectedAsInfeasible(CpSatModel built, SolverStatus solverStatus) {
        List<AutoShowtimeCandidateRejection> rejected = new ArrayList<>();
        for (CandidateVar var : built.candidateVars()) {
            rejected.add(new AutoShowtimeCandidateRejection(var.candidate(), GenerationSkipReason.NO_AVAILABLE_TIME_SLOT,
                    "Solver status " + solverStatus + " - no candidate could be confirmed selected."));
        }
        return new AutoShowtimeSelectionResult(List.of(), rejected);
    }

    private ScheduleOptimizationResult emptyResult(ShowtimeGenerationRun run, int rawCount, int eligibleCount,
            List<AutoShowtimeCandidateRejection> preRejected, long startedAt) {
        Map<String, Integer> prunedByReason = new HashMap<>();
        for (AutoShowtimeCandidateRejection rejection : preRejected) {
            prunedByReason.merge(rejection.reason().name(), 1, Integer::sum);
        }
        SolverDiagnostics diagnostics = new SolverDiagnostics(rawCount, eligibleCount, prunedByReason,
                0, 0, 0, System.currentTimeMillis() - startedAt, false);
        return new ScheduleOptimizationResult(
                new AutoShowtimeSelectionResult(List.of(), preRejected),
                SolverStatus.INFEASIBLE, ObjectiveBreakdown.empty(), diagnostics);
    }

    /// Post-solve diagnostic only (not part of the MILP objective - see CpSatObjectiveBuilder
    /// javadoc): sum of idle minutes between consecutive selected showtimes in the same room on
    /// the same day, normalized by selected-slot count so it's comparable across runs of
    /// different sizes.
    private BigDecimal computeGapPenalty(List<ShowtimeCandidate> selected) {
        if (selected.size() < 2) {
            return BigDecimal.ZERO;
        }
        Map<String, List<ShowtimeCandidate>> byRoomDay = new LinkedHashMap<>();
        for (ShowtimeCandidate candidate : selected) {
            String key = candidate.getCinemaRoomId() + "|" + candidate.getShowDate();
            byRoomDay.computeIfAbsent(key, ignored -> new ArrayList<>()).add(candidate);
        }
        long totalGapMinutes = 0;
        for (List<ShowtimeCandidate> group : byRoomDay.values()) {
            List<ShowtimeCandidate> sorted = group.stream()
                    .sorted(Comparator.comparing(ShowtimeCandidate::temporalStartAt)).toList();
            for (int i = 1; i < sorted.size(); i++) {
                long gap = Duration.between(sorted.get(i - 1).temporalEndAt(), sorted.get(i).temporalStartAt()).toMinutes();
                if (gap > 0) totalGapMinutes += gap;
            }
        }
        return BigDecimal.valueOf(totalGapMinutes)
                .divide(BigDecimal.valueOf(selected.size()), 4, RoundingMode.HALF_UP);
    }
}
