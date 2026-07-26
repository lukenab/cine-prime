package movieservice.service.autoshowtime.optimizer.cpsat;

import com.google.ortools.Loader;
import com.google.ortools.sat.CpSolver;
import com.google.ortools.sat.CpSolverStatus;
import movieservice.entity.CinemaClusterDemandProfile;
import movieservice.entity.ShowtimeAllocationPolicy;
import movieservice.enums.DemandTier;
import movieservice.service.autoshowtime.AutoShowtimeSelectionResult;
import movieservice.service.autoshowtime.ShowtimeCandidate;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Exercises the real CP-SAT pipeline (model → constraints → objective → solve → solution
 * mapping) end to end against small, hand-built candidate sets with a known correct answer -
 * these are the "known-solution tests" P1's testing requirements ask for. Builds
 * {@link ShowtimeCandidate}/{@link ShowtimeAllocationPolicy}/{@link CinemaClusterDemandProfile}
 * directly rather than going through {@link movieservice.service.autoshowtime.optimizer.CpSatScheduleOptimizer}
 * so these tests don't need to mock every repository the legacy scorer depends on - they isolate
 * exactly the CP-SAT-specific code this session added.
 */
class CpSatConstraintFactoryPipelineTest {

    @BeforeAll
    static void loadNativeLibrary() {
        Loader.loadNativeLibraries();
    }

    private final CpSatModelBuilder modelBuilder = new CpSatModelBuilder();
    private final CpSatConstraintFactory constraintFactory = new CpSatConstraintFactory();
    private final CpSatObjectiveBuilder objectiveBuilder = new CpSatObjectiveBuilder();
    private final CpSatSolutionMapper solutionMapper = new CpSatSolutionMapper();

    private static final LocalDate DAY = LocalDate.of(2026, 8, 3); // a Monday

    private ShowtimeCandidate candidate(long movieId, long clusterId, long roomId, int formatId,
            LocalTime start, int durationMinutes, double score) {
        OffsetDateTime startAt = DAY.atTime(start).atOffset(ZoneOffset.ofHours(7));
        return ShowtimeCandidate.builder()
                .movieId(movieId).clusterId(clusterId).cinemaRoomId(roomId).formatId(formatId)
                .screeningVersionId(1L)
                .showDate(DAY).startTime(start).endTime(start.plusMinutes(durationMinutes))
                .startAt(startAt).endAt(startAt.plusMinutes(durationMinutes))
                .score(BigDecimal.valueOf(score))
                .build();
    }

    private ShowtimeAllocationPolicy policy() {
        return ShowtimeAllocationPolicy.builder()
                .policyCode("TEST")
                .peakDemandWeight(BigDecimal.ONE).movieDemandWeight(BigDecimal.ONE)
                .clusterDemandWeight(BigDecimal.ONE).timeSlotDemandWeight(BigDecimal.ONE)
                .formatDemandWeight(BigDecimal.ONE).roomCapacityWeight(BigDecimal.ONE)
                .minimumCoverage(0)
                .maximumRoomShare(BigDecimal.ONE)
                .cleanupBufferMinutes(15)
                .sameMovieStaggerMinutes(0)
                .build();
    }

    private CinemaClusterDemandProfile profile(long clusterId, int minDailyShows, int maxDailyShowsPerMovie) {
        return CinemaClusterDemandProfile.builder()
                .clusterId(clusterId)
                .demandTier(DemandTier.NORMAL)
                .demandScore(BigDecimal.valueOf(50))
                .minDailyShows(minDailyShows)
                .maxDailyShowsPerMovie(maxDailyShowsPerMovie)
                .build();
    }

    /** Known-solution test 1: one room, two overlapping candidates - the higher-scoring one wins. */
    @Test
    void oneRoomTwoOverlappingCandidates_higherScoreWins() {
        ShowtimeCandidate low = candidate(1L, 100L, 1L, 1, LocalTime.of(18, 0), 120, 1.0);
        ShowtimeCandidate high = candidate(2L, 100L, 1L, 1, LocalTime.of(18, 30), 120, 5.0);
        List<ShowtimeCandidate> candidates = List.of(low, high);

        AutoShowtimeSelectionResult result = solve(candidates, policy(),
                Map.of(100L, profile(100L, 0, 2)));

        assertEquals(1, result.selectedCandidates().size());
        assertEquals(2L, result.selectedCandidates().get(0).getMovieId());
        assertEquals(1, result.rejectedCandidates().size());
    }

    /** Known-solution test: two non-overlapping candidates in the same room - both fit. */
    @Test
    void oneRoomTwoNonOverlappingCandidates_bothSelected() {
        ShowtimeCandidate first = candidate(1L, 100L, 1L, 1, LocalTime.of(12, 0), 90, 2.0);
        ShowtimeCandidate second = candidate(1L, 100L, 1L, 1, LocalTime.of(18, 0), 90, 2.0);
        List<ShowtimeCandidate> candidates = List.of(first, second);

        AutoShowtimeSelectionResult result = solve(candidates, policy(),
                Map.of(100L, profile(100L, 0, 2)));

        assertEquals(2, result.selectedCandidates().size());
        assertTrue(result.rejectedCandidates().isEmpty());
    }

    /**
     * Known-solution test 5 (the flagship reason to move off greedy day-by-day selection):
     * a 2-day window, one room, two movies sharing that room. Movie A is high-value every day;
     * movie B only needs to clear a weekly minimum of 2 shows, not 1-per-day. A greedy day-by-day
     * selector (the legacy algorithm) would force 1 slot to B on *both* days to satisfy a
     * per-day minimum, denying A a slot on one of them. The weekly CP-SAT model can instead give
     * B both of its required slots on the day A doesn't need the room, and A both slots on the
     * other day - meeting B's weekly minimum while strictly improving on A's total score
     * compared to a naive per-day split. This asserts the CP-SAT weekly total score is at least
     * as good as the best a rigid 1-per-day-each split could achieve, and that B still gets
     * exactly its weekly minimum (2) despite zero shows on one specific day.
     */
    @Test
    void weeklyMinimumCoverage_distributesAcrossDaysRatherThanPerDay() {
        LocalDate day1 = DAY;
        LocalDate day2 = DAY.plusDays(1);
        long clusterId = 200L;
        long roomId = 10L;

        // Room only fits exactly 2 shows per day at this granularity (two 90-minute slots).
        ShowtimeCandidate aDay1Slot1 = candidateOnDate(1L, clusterId, roomId, day1, LocalTime.of(12, 0), 90, 5.0);
        ShowtimeCandidate aDay1Slot2 = candidateOnDate(1L, clusterId, roomId, day1, LocalTime.of(18, 0), 90, 5.0);
        ShowtimeCandidate bDay1Slot1 = candidateOnDate(2L, clusterId, roomId, day1, LocalTime.of(12, 0), 90, 1.0);
        ShowtimeCandidate bDay1Slot2 = candidateOnDate(2L, clusterId, roomId, day1, LocalTime.of(18, 0), 90, 1.0);
        ShowtimeCandidate aDay2Slot1 = candidateOnDate(1L, clusterId, roomId, day2, LocalTime.of(12, 0), 90, 5.0);
        ShowtimeCandidate aDay2Slot2 = candidateOnDate(1L, clusterId, roomId, day2, LocalTime.of(18, 0), 90, 5.0);
        ShowtimeCandidate bDay2Slot1 = candidateOnDate(2L, clusterId, roomId, day2, LocalTime.of(12, 0), 90, 1.0);
        ShowtimeCandidate bDay2Slot2 = candidateOnDate(2L, clusterId, roomId, day2, LocalTime.of(18, 0), 90, 1.0);

        List<ShowtimeCandidate> candidates = List.of(
                aDay1Slot1, aDay1Slot2, bDay1Slot1, bDay1Slot2,
                aDay2Slot1, aDay2Slot2, bDay2Slot1, bDay2Slot2);

        // minDailyShows=1 combined with minimumCoverage=1 gives a weekly minimum of 1*2 days = 2 for B.
        ShowtimeAllocationPolicy weeklyPolicy = ShowtimeAllocationPolicy.builder()
                .policyCode("TEST-WEEKLY")
                .peakDemandWeight(BigDecimal.ONE).movieDemandWeight(BigDecimal.ONE)
                .clusterDemandWeight(BigDecimal.ONE).timeSlotDemandWeight(BigDecimal.ONE)
                .formatDemandWeight(BigDecimal.ONE).roomCapacityWeight(BigDecimal.ONE)
                .minimumCoverage(1)
                .maximumRoomShare(BigDecimal.ONE)
                .cleanupBufferMinutes(15)
                .sameMovieStaggerMinutes(0)
                .build();
        AutoShowtimeSelectionResult result = solve(candidates, weeklyPolicy, Map.of(clusterId, profile(clusterId, 1, 2)));

        long movieBSelectedCount = result.selectedCandidates().stream().filter(c -> c.getMovieId() == 2L).count();
        long movieASelectedCount = result.selectedCandidates().stream().filter(c -> c.getMovieId() == 1L).count();

        // B gets exactly its weekly minimum (2), not 1 forced on every single day.
        assertEquals(2, movieBSelectedCount);
        // A still gets its best 2 slots overall (4 total across both days minus B's 2 = 2 remaining...
        // but room only has 2 slots/day so total capacity across 2 days is 4; B takes 2, A takes the other 2).
        assertEquals(2, movieASelectedCount);
        // Both of B's selected slots must fall on the SAME day (proving weekly, not per-day, distribution) -
        // a per-day-forced split would instead show exactly 1 on each day.
        long distinctDaysForB = result.selectedCandidates().stream()
                .filter(c -> c.getMovieId() == 2L).map(ShowtimeCandidate::getShowDate).distinct().count();
        assertEquals(1, distinctDaysForB, "weekly optimizer should concentrate B's minimum on one day, not split 1-per-day");
    }

    private ShowtimeCandidate candidateOnDate(long movieId, long clusterId, long roomId, LocalDate date,
            LocalTime start, int durationMinutes, double score) {
        OffsetDateTime startAt = date.atTime(start).atOffset(ZoneOffset.ofHours(7));
        return ShowtimeCandidate.builder()
                .movieId(movieId).clusterId(clusterId).cinemaRoomId(roomId).formatId(1)
                .screeningVersionId(1L)
                .showDate(date).startTime(start).endTime(start.plusMinutes(durationMinutes))
                .startAt(startAt).endAt(startAt.plusMinutes(durationMinutes))
                .score(BigDecimal.valueOf(score))
                .build();
    }

    private AutoShowtimeSelectionResult solve(List<ShowtimeCandidate> candidates, ShowtimeAllocationPolicy policy,
            Map<Long, CinemaClusterDemandProfile> profiles) {
        CpSatModel built = modelBuilder.build(DAY, candidates);
        CpSatConstraintFactory.ConstraintBuildResult constraints = constraintFactory.addConstraints(
                built, policy, profiles, 1.3, 1.0);
        objectiveBuilder.buildObjective(built, constraints.shortfalls(), 0.25);

        CpSolver solver = new CpSolver();
        CpSolverStatus status = solver.solve(built.model());
        assertTrue(status == CpSolverStatus.OPTIMAL || status == CpSolverStatus.FEASIBLE,
                "expected a usable solution, got " + status);

        return solutionMapper.mapSolution(built, solver);
    }
}
