package movieservice.service.autoshowtime;

import lombok.RequiredArgsConstructor;
import movieservice.entity.CinemaRoom;
import movieservice.entity.ShowtimeAllocationPolicy;
import movieservice.entity.ShowtimeGenerationRun;
import movieservice.enums.GenerationReason;
import movieservice.repository.CinemaClusterDemandProfileRepository;
import movieservice.repository.CinemaRoomRepository;
import movieservice.repository.MovieSchedulingProfileRepository;
import movieservice.repository.ShowtimeAllocationFormatPriorityRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalTime;
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

                    /// Peak chỉ boost thành phần timeScore. Không nhân toàn bộ score để không
                    /// vô tình boost cả movie/cluster/format/capacity vốn không liên quan khung giờ.
                    boolean peakSlot = isPeakSlot(candidate.getStartTime(), policy);
                    BigDecimal timeScore = resolveTimeScore(candidate.getStartTime(), policy);
                    if (peakSlot) {
                        timeScore = timeScore.multiply(policy.getPeakDemandWeight());
                    }

                    /// Điểm format được chuẩn hoá theo format có allocation priority cao nhất.
                    BigDecimal formatScore = resolveFormatScore(
                            candidate.getFormatId(),
                            formatPriorityById,
                            maximumFormatPriority
                    );

                    /// Điểm sức chứa: capacity phòng hiện tại / capacity phòng lớn nhất trong cluster.
                    BigDecimal roomCapacityScore = resolveRoomCapacityScore(
                            room.getTotalSeatCapacity(),
                            maxCapacityByCluster.get(candidate.getClusterId())
                    );

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
                            .generationReason(peakSlot
                                    ? GenerationReason.HIGH_DEMAND_PEAK_SLOT
                                    : GenerationReason.DEMAND_QUOTA_ALLOCATION)
                            .build();
                })

                /// Xếp candidate điểm cao trước để bước allocation chọn suất tốt nhất trước.
                .sorted((left, right) -> right.getScore().compareTo(left.getScore()))

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

    /// Peak slot có time score chuẩn hoá cao nhất; off-peak vẫn hợp lệ nhưng điểm thấp hơn.
    private BigDecimal resolveTimeScore(
            LocalTime startTime,
            ShowtimeAllocationPolicy policy
    ) {
        return isPeakSlot(startTime, policy)
                ? BigDecimal.ONE
                : BigDecimal.valueOf(0.40);
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

    /// Chuẩn hoá sức chứa phòng theo phòng lớn nhất trong cùng cluster.
    private BigDecimal resolveRoomCapacityScore(
            Integer roomCapacity,
            Integer maximumClusterCapacity
    ) {
        if (roomCapacity == null || maximumClusterCapacity == null || maximumClusterCapacity == 0) {
            return BigDecimal.ZERO;
        }

        return BigDecimal.valueOf(roomCapacity).divide(
                BigDecimal.valueOf(maximumClusterCapacity),
                4,
                RoundingMode.HALF_UP
        );
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
}
