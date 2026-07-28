package movieservice.service.autoshowtime.optimizer.cpsat;

import com.google.ortools.sat.CpModel;
import com.google.ortools.sat.IntVar;
import com.google.ortools.sat.IntervalVar;
import com.google.ortools.sat.LinearExpr;
import com.google.ortools.sat.Literal;
import movieservice.entity.CinemaClusterDemandProfile;
import movieservice.entity.ShowtimeAllocationPolicy;
import movieservice.service.autoshowtime.ShowtimeCandidate;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Adds every P1 hard constraint to a built {@link CpSatModel}. All constraints operate on
 * whole-week scope (the candidateVars span the entire planning window at once) rather than being
 * re-derived per business date, which is the entire point of moving off the legacy day-by-day
 * greedy selector - see CONSTRAINT_OPTIMIZER_AUDIT.md §4 for exactly which rules this changes.
 *
 * <p>Returns the shortfall variables it introduces for weekly minimum coverage so
 * {@link CpSatObjectiveBuilder} can penalize them without this class needing to know how the
 * objective is built (constraint construction and objective construction stay separate, per the
 * required package boundaries).
 */
@Component
public class CpSatConstraintFactory {

    public record CoverageShortfall(Long movieId, Long clusterId, IntVar shortfall, int softTarget) {
    }

    public record ConstraintBuildResult(int constraintCount, List<CoverageShortfall> shortfalls) {
    }

    public ConstraintBuildResult addConstraints(
            CpSatModel built,
            ShowtimeAllocationPolicy policy,
            Map<Long, CinemaClusterDemandProfile> demandProfileByCluster,
            double softTargetMultiplier,
            double roomShareMultiplier
    ) {
        CpModel model = built.model();
        List<CandidateVar> vars = built.candidateVars();
        int constraintCount = 0;

        constraintCount += addRoomNoOverlap(model, vars);
        constraintCount += addConcurrentRoomShareAndDailyCap(model, vars, policy, demandProfileByCluster, roomShareMultiplier);
        constraintCount += addSameMovieStagger(model, vars, policy);

        List<CoverageShortfall> shortfalls = new ArrayList<>();
        constraintCount += addWeeklyMinimumCoverage(model, vars, policy, demandProfileByCluster, softTargetMultiplier, shortfalls);

        return new ConstraintBuildResult(constraintCount, shortfalls);
    }

    /// HC-01: a room can host at most one showtime at a time (cleanup buffer is already folded
    /// into each candidate's interval size by CpSatModelBuilder's caller - see CpSatScheduleOptimizer).
    private int addRoomNoOverlap(CpModel model, List<CandidateVar> vars) {
        Map<Long, List<IntervalVar>> byRoom = new LinkedHashMap<>();
        for (CandidateVar var : vars) {
            byRoom.computeIfAbsent(var.candidate().getCinemaRoomId(), ignored -> new ArrayList<>()).add(var.interval());
        }
        int count = 0;
        for (List<IntervalVar> intervals : byRoom.values()) {
            if (intervals.size() < 2) continue;
            model.addNoOverlap(intervals);
            count++;
        }
        return count;
    }

    /// HC-09 (ST-BR-033): at most maximumRoomShare*availableRooms rooms may show the same movie
    /// concurrently in one cluster/date. Modeled as a Cumulative resource (capacity = allowed
    /// room count, each candidate demands 1 unit while its interval is present) rather than a
    /// hand-rolled per-instant sweep - Cumulative already reasons about interval overlap
    /// natively. Also enforces max_daily_shows_per_movie as a simple linear sum bound in the
    /// same per-(movie,cluster,date) grouping pass.
    private int addConcurrentRoomShareAndDailyCap(
            CpModel model,
            List<CandidateVar> vars,
            ShowtimeAllocationPolicy policy,
            Map<Long, CinemaClusterDemandProfile> demandProfileByCluster,
            double roomShareMultiplier
    ) {
        Map<MovieClusterDayKey, List<CandidateVar>> byMovieClusterDay = new LinkedHashMap<>();
        for (CandidateVar var : vars) {
            byMovieClusterDay
                    .computeIfAbsent(MovieClusterDayKey.from(var.candidate()), ignored -> new ArrayList<>())
                    .add(var);
        }
        // Distinct room count per cluster/date (not per movie) drives the concurrent-share cap.
        Map<ClusterDayKey, java.util.Set<Long>> roomsByClusterDay = new HashMap<>();
        for (CandidateVar var : vars) {
            roomsByClusterDay
                    .computeIfAbsent(ClusterDayKey.from(var.candidate()), ignored -> new java.util.HashSet<>())
                    .add(var.candidate().getCinemaRoomId());
        }

        int constraintCount = 0;
        for (Map.Entry<MovieClusterDayKey, List<CandidateVar>> entry : byMovieClusterDay.entrySet()) {
            MovieClusterDayKey key = entry.getKey();
            List<CandidateVar> groupVars = entry.getValue();
            CinemaClusterDemandProfile profile = demandProfileByCluster.get(key.clusterId());
            if (profile == null) {
                continue; // filtered out before model-building in CpSatScheduleOptimizer; defensive no-op here
            }

            int availableRooms = roomsByClusterDay.getOrDefault(ClusterDayKey.of(key.clusterId(), key.showDate()), java.util.Set.of()).size();
            int maxConcurrentRooms = maximumRoomsForMovie(policy.getMaximumRoomShare(), roomShareMultiplier, availableRooms);

            List<IntervalVar> intervals = groupVars.stream().map(CandidateVar::interval).toList();
            if (intervals.size() > 1) {
                model.addCumulative(LinearExpr.constant(maxConcurrentRooms))
                        .addDemands(intervals.toArray(new IntervalVar[0]), ones(intervals.size()));
                constraintCount++;
            }

            int maxDailyShows = profile.getMaxDailyShowsPerMovie();
            List<Literal> presences = groupVars.stream().map(v -> (Literal) v.presence()).toList();
            model.addLessOrEqual(LinearExpr.sum(presences.toArray(new Literal[0])), maxDailyShows);
            constraintCount++;
        }
        return constraintCount;
    }

    /// Same-movie start stagger: two starts of the same movie in different rooms of the same
    /// cluster/date must be at least sameMovieStaggerMinutes apart. Encoded pairwise
    /// (NOT(x_i AND x_j) via addBoolOr on negated literals) - tractable because this is only
    /// ever evaluated within one (movie, cluster, date) group, which is small in practice.
    private int addSameMovieStagger(CpModel model, List<CandidateVar> vars, ShowtimeAllocationPolicy policy) {
        int requiredMinutes = policy.getSameMovieStaggerMinutes() == null ? 0 : policy.getSameMovieStaggerMinutes();
        if (requiredMinutes <= 0) {
            return 0;
        }

        Map<MovieClusterDayKey, List<CandidateVar>> byMovieClusterDay = new LinkedHashMap<>();
        for (CandidateVar var : vars) {
            byMovieClusterDay
                    .computeIfAbsent(MovieClusterDayKey.from(var.candidate()), ignored -> new ArrayList<>())
                    .add(var);
        }

        int constraintCount = 0;
        for (List<CandidateVar> groupVars : byMovieClusterDay.values()) {
            for (int i = 0; i < groupVars.size(); i++) {
                for (int j = i + 1; j < groupVars.size(); j++) {
                    CandidateVar left = groupVars.get(i);
                    CandidateVar right = groupVars.get(j);
                    if (left.candidate().getCinemaRoomId().equals(right.candidate().getCinemaRoomId())) {
                        continue; // same-room conflicts are already handled by NoOverlap
                    }
                    long distance = Math.abs(left.startMinutes() - right.startMinutes());
                    if (distance < requiredMinutes) {
                        model.addBoolOr(new Literal[]{left.presence().not(), right.presence().not()});
                        constraintCount++;
                    }
                }
            }
        }
        return constraintCount;
    }

    /// Weekly minimum coverage: unlike the legacy per-day quota, the minimum is only required
    /// as a WEEKLY total per (movie, cluster) - the solver decides how to distribute it across
    /// days. A soft target above the hard floor is also introduced here (as a shortfall IntVar)
    /// so CpSatObjectiveBuilder can reward exceeding the bare minimum without a second hard
    /// constraint that could make the model infeasible for no good reason.
    private int addWeeklyMinimumCoverage(
            CpModel model,
            List<CandidateVar> vars,
            ShowtimeAllocationPolicy policy,
            Map<Long, CinemaClusterDemandProfile> demandProfileByCluster,
            double softTargetMultiplier,
            List<CoverageShortfall> shortfalls
    ) {
        Map<MovieClusterKey, List<CandidateVar>> byMovieCluster = new LinkedHashMap<>();
        Map<MovieClusterKey, java.util.Set<LocalDate>> daysByMovieCluster = new HashMap<>();
        for (CandidateVar var : vars) {
            MovieClusterKey key = MovieClusterKey.from(var.candidate());
            byMovieCluster.computeIfAbsent(key, ignored -> new ArrayList<>()).add(var);
            daysByMovieCluster.computeIfAbsent(key, ignored -> new java.util.HashSet<>())
                    .add(var.candidate().getShowDate());
        }

        int constraintCount = 0;
        for (Map.Entry<MovieClusterKey, List<CandidateVar>> entry : byMovieCluster.entrySet()) {
            MovieClusterKey key = entry.getKey();
            List<CandidateVar> groupVars = entry.getValue();
            CinemaClusterDemandProfile profile = demandProfileByCluster.get(key.clusterId());
            if (profile == null) {
                continue;
            }

            int distinctDays = daysByMovieCluster.get(key).size();
            int perDayMinimum = Math.min(
                    Math.max(policy.getMinimumCoverage(), profile.getMinDailyShows()),
                    profile.getMaxDailyShowsPerMovie());
            int weeklyMinimum = Math.min(perDayMinimum * distinctDays, groupVars.size());

            List<Literal> presences = groupVars.stream().map(v -> (Literal) v.presence()).toList();
            if (weeklyMinimum > 0) {
                model.addGreaterOrEqual(LinearExpr.sum(presences.toArray(new Literal[0])), weeklyMinimum);
                constraintCount++;
            }

            int softTarget = Math.min(groupVars.size(),
                    (int) Math.ceil(weeklyMinimum * Math.max(1.0, softTargetMultiplier)));
            if (softTarget > weeklyMinimum) {
                IntVar shortfall = model.newIntVar(0, softTarget, "shortfall_" + key.movieId() + "_" + key.clusterId());
                // shortfall + sum(presence) >= softTarget  <=>  shortfall >= softTarget - sum(presence)
                List<com.google.ortools.sat.LinearArgument> terms = new ArrayList<>();
                terms.add(shortfall);
                terms.addAll(presences);
                model.addGreaterOrEqual(
                        LinearExpr.sum(terms.toArray(new com.google.ortools.sat.LinearArgument[0])), softTarget);
                constraintCount++;
                shortfalls.add(new CoverageShortfall(key.movieId(), key.clusterId(), shortfall, softTarget));
            }
        }
        return constraintCount;
    }

    private int maximumRoomsForMovie(BigDecimal maximumRoomShare, double scenarioMultiplier, int availableRoomCount) {
        if (availableRoomCount <= 0) {
            return 0;
        }
        BigDecimal share = maximumRoomShare.multiply(BigDecimal.valueOf(scenarioMultiplier))
                .min(BigDecimal.ONE);
        int configuredLimit = share.multiply(BigDecimal.valueOf(availableRoomCount))
                .setScale(0, RoundingMode.FLOOR).intValue();
        return Math.max(1, configuredLimit);
    }

    private long[] ones(int count) {
        long[] result = new long[count];
        java.util.Arrays.fill(result, 1L);
        return result;
    }

    private record MovieClusterDayKey(Long movieId, Long clusterId, LocalDate showDate) {
        static MovieClusterDayKey from(ShowtimeCandidate candidate) {
            return new MovieClusterDayKey(candidate.getMovieId(), candidate.getClusterId(), candidate.getShowDate());
        }
    }

    private record ClusterDayKey(Long clusterId, LocalDate showDate) {
        static ClusterDayKey from(ShowtimeCandidate candidate) {
            return new ClusterDayKey(candidate.getClusterId(), candidate.getShowDate());
        }

        static ClusterDayKey of(Long clusterId, LocalDate showDate) {
            return new ClusterDayKey(clusterId, showDate);
        }
    }

    private record MovieClusterKey(Long movieId, Long clusterId) {
        static MovieClusterKey from(ShowtimeCandidate candidate) {
            return new MovieClusterKey(candidate.getMovieId(), candidate.getClusterId());
        }
    }
}
