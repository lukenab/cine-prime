package movieservice.service.autoshowtime;

import lombok.RequiredArgsConstructor;
import movieservice.entity.CinemaRoom;
import movieservice.entity.ShowtimeAllocationPolicy;
import movieservice.entity.ShowtimeDaypartPolicy;
import movieservice.entity.ShowtimeGenerationRun;
import movieservice.enums.GenerationReason;
import movieservice.repository.CinemaClusterDemandProfileRepository;
import movieservice.repository.CinemaRoomRepository;
import movieservice.repository.MovieSchedulingProfileRepository;
import movieservice.repository.ShowtimeAllocationFormatPriorityRepository;
import movieservice.repository.ShowtimeDaypartPolicyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalTime;
import java.time.DayOfWeek;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AutoShowtimeCandidateScorer {

    private final MovieSchedulingProfileRepository movieSchedulingProfileRepository;
    private final CinemaClusterDemandProfileRepository clusterDemandProfileRepository;
    private final CinemaRoomRepository cinemaRoomRepository;
    private final ShowtimeAllocationFormatPriorityRepository formatPriorityRepository;
    private final ShowtimeDaypartPolicyRepository daypartPolicyRepository;

    /**
     * Chấm điểm các candidate hợp lệ rồi sắp xếp từ điểm cao xuống thấp.
     * Method này chỉ xếp hạng, chưa tạo hoặc lưu ShowTime xuống database.
     */
    @Transactional(readOnly = true)
    public List<ShowtimeCandidate> scoreAndRank(
            ShowtimeGenerationRun run,
            List<ShowtimeCandidate> candidates
    ) {
        ShowtimeAllocationPolicy policy = run.getPolicy();

        Map<Long, CinemaRoom> roomById = cinemaRoomRepository.findAllById(
                candidates.stream()
                        .map(ShowtimeCandidate::getCinemaRoomId)
                        .collect(Collectors.toSet())
        ).stream().collect(Collectors.toMap(
                CinemaRoom::getCinemaRoomId,
                Function.identity()
        ));

        Map<Long, Integer> maxCapacityByCluster = new HashMap<>();
        for (ShowtimeCandidate candidate : candidates) {
            CinemaRoom room = roomById.get(candidate.getCinemaRoomId());
            if (room != null) {
                maxCapacityByCluster.merge(
                        candidate.getClusterId(),
                        room.getTotalSeatCapacity(),
                        Integer::max
                );
            }
        }

        Map<Integer, Integer> formatPriorityById = loadFormatPriorities(policy.getPolicyId());
        List<ShowtimeDaypartPolicy> dayparts = daypartPolicyRepository
                .findByPolicy_PolicyIdAndActiveTrueOrderByStartTime(policy.getPolicyId());
        int maximumFormatPriority = formatPriorityById.values().stream()
                .max(Integer::compareTo)
                .orElse(1);

        Map<Long, BigDecimal> movieScoreById = new HashMap<>();
        Map<Long, BigDecimal> clusterScoreById = new HashMap<>();

        return candidates.stream()

                /// Chỉ giữ candidate có cinema room còn tồn tại trong database.
                /// Nếu room bị xoá sau khi candidate được tạo thì không được persist suất chiếu đó.
                .filter(candidate -> roomById.containsKey(candidate.getCinemaRoomId()))

                /// Chấm điểm từng candidate và tạo object candidate mới chứa score.
                .map(candidate -> {
                    CinemaRoom room = roomById.get(candidate.getCinemaRoomId());

                    /// Lấy điểm phim đã chuẩn hoá 0..1.
                    /// computeIfAbsent giúp mỗi movieId chỉ query/tính score một lần,
                    /// các candidate khác của cùng phim sẽ tái sử dụng kết quả đã cache.
                    BigDecimal movieScore = movieScoreById.computeIfAbsent(
                            candidate.getMovieId(),
                            this::resolveMovieScore
                    );

                    /// Lấy điểm demand của cluster, cũng được cache theo clusterId.
                    BigDecimal clusterScore = clusterScoreById.computeIfAbsent(
                            candidate.getClusterId(),
                            this::resolveClusterDemandScore
                    );

                    ResolvedDaypart daypart = resolveDaypart(candidate, policy, dayparts);
                    BigDecimal timeScore = daypart.demandMultiplier();

                    /// Điểm format được chuẩn hoá theo format có allocation priority cao nhất.
                    BigDecimal formatScore = resolveFormatScore(
                            candidate.getFormatId(),
                            formatPriorityById,
                            maximumFormatPriority
                    );

                    int expectedAttendance = resolveExpectedAttendance(
                            movieScore, clusterScore, timeScore, formatScore,
                            maxCapacityByCluster.get(candidate.getClusterId()));
                    BigDecimal roomCapacityScore = resolveRoomCapacityFitScore(
                            room.getTotalSeatCapacity(), expectedAttendance,
                            maxCapacityByCluster.get(candidate.getClusterId()));

                    /// Tính điểm nền bằng công thức có trọng số lấy từ policy database.
                    // Không hardcode trọng số trong service.
                    BigDecimal score = movieScore.multiply(policy.getMovieDemandWeight())
                            .add(clusterScore.multiply(policy.getClusterDemandWeight()))
                            .add(timeScore.multiply(policy.getTimeSlotDemandWeight()))
                            .add(formatScore.multiply(policy.getFormatDemandWeight()))
                            .add(roomCapacityScore.multiply(policy.getRoomCapacityWeight()));

                    /// Candidate là object immutable, dùng toBuilder để giữ toàn bộ dữ liệu cũ và chỉ bổ sung score cùng lý do được ưu tiên.
                    return candidate.toBuilder()
                            .score(score.setScale(4, RoundingMode.HALF_UP))
                            .scoreBreakdown(new ShowtimeScoreBreakdown(
                                    daypart.code(),
                                    movieScore.setScale(4, RoundingMode.HALF_UP),
                                    clusterScore.setScale(4, RoundingMode.HALF_UP),
                                    timeScore.setScale(4, RoundingMode.HALF_UP),
                                    formatScore.setScale(4, RoundingMode.HALF_UP),
                                    roomCapacityScore.setScale(4, RoundingMode.HALF_UP),
                                    expectedAttendance,
                                    room.getTotalSeatCapacity()))
                            .generationReason(daypart.peak()
                                    ? GenerationReason.HIGH_DEMAND_PEAK_SLOT
                                    : GenerationReason.DEMAND_QUOTA_ALLOCATION)
                            .build();
                })

                /// Xếp candidate điểm cao trước để bước allocation chọn suất tốt nhất trước.
                .sorted(Comparator
                        .comparing(ShowtimeCandidate::getScore).reversed()
                        .thenComparing(ShowtimeCandidate::getClusterId)
                        .thenComparing(ShowtimeCandidate::getShowDate)
                        .thenComparing(ShowtimeCandidate::temporalStartAt)
                        .thenComparing(ShowtimeCandidate::getCinemaRoomId)
                        .thenComparing(ShowtimeCandidate::getMovieId)
                        .thenComparing(ShowtimeCandidate::getFormatId))

                .toList();
    }

    /// Ưu tiên điểm do admin override; nếu không có thì dùng popularity score đã cấu hình cho phim. */
    private BigDecimal resolveMovieScore(Long movieId) {
        BigDecimal rawScore = movieSchedulingProfileRepository.findByMovie_MovieId(movieId)
                .map(profile -> profile.getPriorityOverride() != null
                        ? profile.getPriorityOverride()
                        : profile.getPopularityScore())
                .orElse(BigDecimal.ZERO);

        return normalizeScore(rawScore);
    }

    /// Chuẩn hoá demand score của cluster từ khoảng 0..100 về khoảng 0..1. */
    private BigDecimal resolveClusterDemandScore(Long clusterId) {
        BigDecimal rawScore = clusterDemandProfileRepository.findByCluster_ClusterId(clusterId)
                .map(profile -> profile.getDemandScore())
                .orElse(BigDecimal.ZERO);

        return normalizeScore(rawScore);
    }

    private ResolvedDaypart resolveDaypart(
            ShowtimeCandidate candidate,
            ShowtimeAllocationPolicy policy,
            List<ShowtimeDaypartPolicy> dayparts
    ) {
        for (ShowtimeDaypartPolicy daypart : dayparts) {
            if (contains(daypart.getStartTime(), daypart.getEndTime(), candidate.getStartTime())) {
                DayOfWeek day = candidate.getShowDate().getDayOfWeek();
                boolean weekend = day == DayOfWeek.SATURDAY || day == DayOfWeek.SUNDAY;
                BigDecimal multiplier = weekend
                        ? daypart.getWeekendDemandMultiplier()
                        : daypart.getWeekdayDemandMultiplier();
                boolean peak = daypart.getDaypartCode() == movieservice.enums.ShowtimeDaypart.EVENING;
                return new ResolvedDaypart(daypart.getDaypartCode().name(), multiplier, peak);
            }
        }

        boolean peak = isPeakSlot(candidate.getStartTime(), policy);
        return new ResolvedDaypart(
                peak ? "PEAK" : "OFF_PEAK",
                peak ? policy.getPeakDemandWeight() : BigDecimal.valueOf(0.40),
                peak);
    }

    private boolean contains(LocalTime start, LocalTime end, LocalTime value) {
        if (end.isAfter(start)) {
            return !value.isBefore(start) && value.isBefore(end);
        }
        return !value.isBefore(start) || value.isBefore(end);
    }

    /// Khung giờ peak là [peakStartTime, peakEndTime): có lấy mốc đầu, không lấy mốc cuối.
    private boolean isPeakSlot(
            LocalTime startTime,
            ShowtimeAllocationPolicy policy
    ) {
        return !startTime.isBefore(policy.getPeakStartTime())
                && startTime.isBefore(policy.getPeakEndTime());
    }

    /// Chuẩn hoá allocation priority của format theo format có priority lớn nhất trong policy
    private BigDecimal resolveFormatScore(
            Integer formatId,
            Map<Integer, Integer> formatPriorityById,
            int maximumFormatPriority
    ) {
        int priority = formatPriorityById.getOrDefault(formatId, 0);

        return BigDecimal.valueOf(priority).divide(
                BigDecimal.valueOf(maximumFormatPriority),
                4,
                RoundingMode.HALF_UP
        );
    }

    /**
     * Estimate an absolute audience from the current rule-based inputs. This is deliberately
     * deterministic and replaceable by a forecast snapshot later; it must not depend on the
     * candidate room, otherwise every room would appear to be a perfect fit.
     */
    private int resolveExpectedAttendance(
            BigDecimal movieScore,
            BigDecimal clusterScore,
            BigDecimal timeScore,
            BigDecimal formatScore,
            Integer maximumClusterCapacity
    ) {
        if (maximumClusterCapacity == null || maximumClusterCapacity <= 0) {
            return 0;
        }
        BigDecimal baseDemand = movieScore.multiply(BigDecimal.valueOf(0.70))
                .add(clusterScore.multiply(BigDecimal.valueOf(0.30)));
        BigDecimal formatMultiplier = BigDecimal.valueOf(0.85)
                .add(formatScore.multiply(BigDecimal.valueOf(0.15)));
        BigDecimal demandRatio = clamp(baseDemand.multiply(timeScore).multiply(formatMultiplier),
                BigDecimal.valueOf(0.05), BigDecimal.ONE);
        return demandRatio.multiply(BigDecimal.valueOf(maximumClusterCapacity))
                .setScale(0, RoundingMode.HALF_UP).intValue();
    }

    /**
     * Penalise lost demand more heavily than empty capacity. This replaces the old
     * capacity/maxCapacity ratio which always rewarded the largest auditorium.
     */
    private BigDecimal resolveRoomCapacityFitScore(
            Integer roomCapacity,
            Integer expectedAttendance,
            Integer maximumClusterCapacity
    ) {
        if (roomCapacity == null || expectedAttendance == null
                || maximumClusterCapacity == null || maximumClusterCapacity == 0) {
            return BigDecimal.ZERO;
        }
        int overflowDemand = Math.max(0, expectedAttendance - roomCapacity);
        int emptyCapacity = Math.max(0, roomCapacity - expectedAttendance);
        BigDecimal penalty = BigDecimal.valueOf(overflowDemand)
                .add(BigDecimal.valueOf(emptyCapacity).multiply(BigDecimal.valueOf(0.50)))
                .divide(BigDecimal.valueOf(maximumClusterCapacity), 4, RoundingMode.HALF_UP);
        return clamp(BigDecimal.ONE.subtract(penalty), BigDecimal.ZERO, BigDecimal.ONE);
    }

    private BigDecimal clamp(BigDecimal value, BigDecimal minimum, BigDecimal maximum) {
        return value.max(minimum).min(maximum);
    }

    /// Giới hạn score cấu hình trong 0..100 trước khi chuẩn hoá thành khoảng 0..1.
    private BigDecimal normalizeScore(BigDecimal rawScore) {
        if (rawScore == null) {
            return BigDecimal.ZERO;
        }

        BigDecimal bounded = rawScore.max(BigDecimal.ZERO).min(BigDecimal.valueOf(100));
        return bounded.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
    }

    private Map<Integer, Integer> loadFormatPriorities(Long policyId) {
        Map<Integer, Integer> formatPriorityById = new HashMap<>();

        formatPriorityRepository.findAllByPolicyIdWithFormat(policyId)
                .forEach(priority -> formatPriorityById.put(
                        priority.getScreeningFormat().getFormatId(),
                        priority.getAllocationPriority()
                ));

        return formatPriorityById;
    }

    private record ResolvedDaypart(String code, BigDecimal demandMultiplier, boolean peak) {
    }
}
