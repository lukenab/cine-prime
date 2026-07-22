package movieservice.service.autoshowtime;

import lombok.RequiredArgsConstructor;
import movieservice.entity.CinemaClusterDemandProfile;
import movieservice.entity.ShowtimeAllocationPolicy;
import movieservice.entity.ShowtimeGenerationRun;
import movieservice.enums.GenerationSkipReason;
import movieservice.repository.CinemaClusterDemandProfileRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AutoShowtimeCandidateSelector {

    private final CinemaClusterDemandProfileRepository clusterDemandProfileRepository;

    /// Chọn candidate theo hai vòng:
    /// 1. Đảm bảo quota tối thiểu cho mỗi movie + cluster + ngày.
    /// 2. Cấp thêm suất theo score cho đến khi chạm quota tối đa hoặc hard constraint.
    @Transactional(readOnly = true)
    public AutoShowtimeSelectionResult select(
            ShowtimeGenerationRun run,
            List<ShowtimeCandidate> rankedCandidates
    ) {
        ShowtimeAllocationPolicy policy = run.getPolicy();

        /// Chắc chắn đầu vào luôn được xét từ score cao đến thấp, dù caller có truyền list chưa sort.
        List<ShowtimeCandidate> sortedCandidates = rankedCandidates.stream()
                .sorted(Comparator.comparing(ShowtimeCandidate::getScore).reversed())
                .toList();

        /// Cache demand profile theo cluster để không query lại cho từng candidate.
        Map<Long, Optional<CinemaClusterDemandProfile>> profileByClusterId = new HashMap<>();

        /// Tổng số room có candidate trong từng cluster/ngày dùng để tính maximum_room_share.
        Map<ClusterDayKey, Integer> availableRoomCountByClusterDay = buildAvailableRoomCounts(sortedCandidates);

        /// Đếm số suất đã chọn cho từng movie trong một cluster tại một ngày.
        Map<MovieClusterDayKey, Integer> selectedShowCountByMovieClusterDay = new HashMap<>();

        /// Theo dõi các room mà một movie đang dùng để kiểm soát maximum_room_share.
        Map<MovieClusterDayKey, Set<Long>> selectedRoomIdsByMovieClusterDay = new HashMap<>();

        /// Theo dõi các suất đã chọn trong room/ngày để không tự tạo suất chồng giờ.
        Map<RoomDayKey, List<ShowtimeCandidate>> selectedCandidatesByRoomDay = new HashMap<>();

        List<ShowtimeCandidate> selected = new ArrayList<>();
        List<AutoShowtimeCandidateRejection> rejected = new ArrayList<>();
        List<ShowtimeCandidate> candidatesForExtraAllocation = new ArrayList<>();

        Map<MovieClusterDayKey, List<ShowtimeCandidate>> candidatesByCoverageKey = new LinkedHashMap<>();
        for (ShowtimeCandidate candidate : sortedCandidates) {
            Optional<CinemaClusterDemandProfile> profile = profileByClusterId.computeIfAbsent(
                    candidate.getClusterId(),
                    clusterDemandProfileRepository::findByCluster_ClusterId
            );

            if (profile.isEmpty()) {
                rejected.add(reject(candidate, GenerationSkipReason.MISSING_DEMAND_PROFILE,
                        "Cinema cluster does not have a demand profile."));
                continue;
            }

            candidatesByCoverageKey
                    .computeIfAbsent(MovieClusterDayKey.from(candidate), ignored -> new ArrayList<>())
                    .add(candidate);
        }

        // Allocate at most one slot per movie/cluster/day on each pass. This prevents the
        // highest-scoring title from consuming all compatible rooms before another title is seen.
        Map<MovieClusterDayKey, Integer> nextCandidateIndex = new HashMap<>();
        boolean madeProgress;
        do {
            madeProgress = false;
            for (Map.Entry<MovieClusterDayKey, List<ShowtimeCandidate>> entry : candidatesByCoverageKey.entrySet()) {
                MovieClusterDayKey key = entry.getKey();
                CinemaClusterDemandProfile profile = profileByClusterId.get(key.clusterId()).orElseThrow();
                int minimum = minimumShowCount(policy, profile);
                if (selectedShowCountByMovieClusterDay.getOrDefault(key, 0) >= minimum) continue;

                int index = nextCandidateIndex.getOrDefault(key, 0);
                while (index < entry.getValue().size()) {
                    ShowtimeCandidate candidate = entry.getValue().get(index++);
                    nextCandidateIndex.put(key, index);
                    if (attemptSelection(candidate, policy, availableRoomCountByClusterDay,
                            selectedShowCountByMovieClusterDay, selectedRoomIdsByMovieClusterDay,
                            selectedCandidatesByRoomDay, selected, rejected)) {
                        madeProgress = true;
                        break;
                    }
                }
            }
        } while (madeProgress);

        for (Map.Entry<MovieClusterDayKey, List<ShowtimeCandidate>> entry : candidatesByCoverageKey.entrySet()) {
            int index = nextCandidateIndex.getOrDefault(entry.getKey(), 0);
            candidatesForExtraAllocation.addAll(entry.getValue().subList(index, entry.getValue().size()));
        }
        candidatesForExtraAllocation.sort(Comparator.comparing(ShowtimeCandidate::getScore).reversed());

        /// Vòng 2: candidate score cao được cấp thêm suất, nhưng không vượt max_daily_shows_per_movie.
        for (ShowtimeCandidate candidate : candidatesForExtraAllocation) {
            CinemaClusterDemandProfile profile = profileByClusterId
                    .get(candidate.getClusterId())
                    .orElseThrow();

            MovieClusterDayKey quotaKey = MovieClusterDayKey.from(candidate);
            int currentShowCount = selectedShowCountByMovieClusterDay.getOrDefault(quotaKey, 0);

            if (currentShowCount >= profile.getMaxDailyShowsPerMovie()) {
                rejected.add(reject(candidate, GenerationSkipReason.MAX_DAILY_SHOWS_PER_MOVIE_REACHED,
                        "Candidate exceeds max_daily_shows_per_movie for this movie, cluster and date."));
                continue;
            }

            attemptSelection(
                    candidate,
                    policy,
                    availableRoomCountByClusterDay,
                    selectedShowCountByMovieClusterDay,
                    selectedRoomIdsByMovieClusterDay,
                    selectedCandidatesByRoomDay,
                    selected,
                    rejected
            );
        }

        return new AutoShowtimeSelectionResult(selected, rejected);
    }

    /// Thử chọn một candidate sau khi kiểm tra room share và conflict trong room.
    private boolean attemptSelection(
            ShowtimeCandidate candidate,
            ShowtimeAllocationPolicy policy,
            Map<ClusterDayKey, Integer> availableRoomCountByClusterDay,
            Map<MovieClusterDayKey, Integer> selectedShowCountByMovieClusterDay,
            Map<MovieClusterDayKey, Set<Long>> selectedRoomIdsByMovieClusterDay,
            Map<RoomDayKey, List<ShowtimeCandidate>> selectedCandidatesByRoomDay,
            List<ShowtimeCandidate> selected,
            List<AutoShowtimeCandidateRejection> rejected
    ) {
        MovieClusterDayKey movieClusterDayKey = MovieClusterDayKey.from(candidate);
        RoomDayKey roomDayKey = RoomDayKey.from(candidate);
        Set<Long> roomIdsUsedByMovie = selectedRoomIdsByMovieClusterDay
                .computeIfAbsent(movieClusterDayKey, ignored -> new HashSet<>());

        boolean usesNewRoom = !roomIdsUsedByMovie.contains(candidate.getCinemaRoomId());
        int availableRoomCount = availableRoomCountByClusterDay.getOrDefault(
                ClusterDayKey.from(candidate),
                0
        );

        if (usesNewRoom && roomIdsUsedByMovie.size() >= maximumRoomsForMovie(policy, availableRoomCount)) {
            rejected.add(reject(candidate, GenerationSkipReason.MAXIMUM_ROOM_SHARE_REACHED,
                    "Candidate would exceed maximum_room_share in this cluster and date."));
            return false;
        }

        List<ShowtimeCandidate> selectedInSameRoom = selectedCandidatesByRoomDay
                .computeIfAbsent(roomDayKey, ignored -> new ArrayList<>());

        if (hasCleanupBufferConflict(candidate, selectedInSameRoom, policy)) {
            rejected.add(reject(candidate, GenerationSkipReason.CLEANUP_BUFFER_CONFLICT,
                    "Candidate overlaps a selected candidate in the same room after cleanup buffer is applied."));
            return false;
        }

        /// Candidate vượt qua hard constraint trong bộ nhớ, nên được chọn để bước persist xử lý tiếp.
        selected.add(candidate);
        selectedInSameRoom.add(candidate);
        roomIdsUsedByMovie.add(candidate.getCinemaRoomId());
        selectedShowCountByMovieClusterDay.merge(movieClusterDayKey, 1, Integer::sum);
        return true;
    }

    /// Deadline rule: min_daily_shows là baseline cho mỗi movie + cluster + ngày.
    /// minimum_coverage của policy vẫn được áp dụng nếu nó lớn hơn profile quota.
    private int minimumShowCount(
            ShowtimeAllocationPolicy policy,
            CinemaClusterDemandProfile profile
    ) {
        int minimum = Math.max(policy.getMinimumCoverage(), profile.getMinDailyShows());
        return Math.min(minimum, profile.getMaxDailyShowsPerMovie());
    }

    /// Tính số room tối đa mà một movie được phép chiếm trong một cluster/ngày.
    /// Làm tròn xuống để không vượt quá maximum_room_share; vẫn cho phép tối thiểu một room nếu cluster có room.
    private int maximumRoomsForMovie(
            ShowtimeAllocationPolicy policy,
            int availableRoomCount
    ) {
        if (availableRoomCount == 0) {
            return 0;
        }

        int configuredLimit = policy.getMaximumRoomShare()
                .multiply(BigDecimal.valueOf(availableRoomCount))
                .setScale(0, RoundingMode.FLOOR)
                .intValue();

        return Math.max(1, configuredLimit);
    }

    /// Hai suất conflict khi một suất bắt đầu trước lúc suất kia kết thúc cộng cleanup buffer.
    private boolean hasCleanupBufferConflict(
            ShowtimeCandidate candidate,
            List<ShowtimeCandidate> selectedInSameRoom,
            ShowtimeAllocationPolicy policy
    ) {
        OffsetDateTime candidateEndWithCleanup = candidate.temporalEndAt()
                .plusMinutes(policy.getCleanupBufferMinutes());

        return selectedInSameRoom.stream().anyMatch(selectedCandidate -> {
            OffsetDateTime selectedEndWithCleanup = selectedCandidate.temporalEndAt()
                    .plusMinutes(policy.getCleanupBufferMinutes());

            return candidate.temporalStartAt().isBefore(selectedEndWithCleanup)
                    && selectedCandidate.temporalStartAt().isBefore(candidateEndWithCleanup);
        });
    }

    /// Lấy số room khác nhau xuất hiện trong candidate list của từng cluster/ngày.
    private Map<ClusterDayKey, Integer> buildAvailableRoomCounts(
            List<ShowtimeCandidate> candidates
    ) {
        return candidates.stream().collect(Collectors.groupingBy(
                ClusterDayKey::from,
                Collectors.collectingAndThen(
                        Collectors.mapping(ShowtimeCandidate::getCinemaRoomId, Collectors.toSet()),
                        Set::size
                )
        ));
    }

    /// Đóng gói rejection để service persist skip audit ở bước tiếp theo.
    private AutoShowtimeCandidateRejection reject(
            ShowtimeCandidate candidate,
            GenerationSkipReason reason,
            String detail
    ) {
        return new AutoShowtimeCandidateRejection(candidate, reason, detail);
    }

    /// Key quota: một movie tại một cluster trong một ngày.
    private record MovieClusterDayKey(Long movieId, Long clusterId, LocalDate showDate) {
        private static MovieClusterDayKey from(ShowtimeCandidate candidate) {
            return new MovieClusterDayKey(
                    candidate.getMovieId(),
                    candidate.getClusterId(),
                    candidate.getShowDate()
            );
        }
    }

    /// Key dùng cho maximum_room_share: một cluster trong một ngày.
    private record ClusterDayKey(Long clusterId, LocalDate showDate) {
        private static ClusterDayKey from(ShowtimeCandidate candidate) {
            return new ClusterDayKey(candidate.getClusterId(), candidate.getShowDate());
        }
    }

    /// Key chống xung đột: một phòng trong một ngày.
    private record RoomDayKey(Long cinemaRoomId, LocalDate showDate) {
        private static RoomDayKey from(ShowtimeCandidate candidate) {
            return new RoomDayKey(candidate.getCinemaRoomId(), candidate.getShowDate());
        }
    }
}
