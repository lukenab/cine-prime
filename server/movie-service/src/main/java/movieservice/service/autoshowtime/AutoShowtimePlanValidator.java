package movieservice.service.autoshowtime;

import lombok.RequiredArgsConstructor;
import movieservice.entity.CinemaClusterDemandProfile;
import movieservice.entity.ShowtimeAllocationPolicy;
import movieservice.entity.ShowtimeGenerationRun;
import movieservice.repository.CinemaClusterDemandProfileRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;

@Service
@RequiredArgsConstructor
public class AutoShowtimePlanValidator {
    private final CinemaClusterDemandProfileRepository profileRepository;
    private final SchedulingOperationalConstraintService operationalConstraintService;

    public AutoShowtimePlanValidationResult validate(
            ShowtimeGenerationRun run,
            List<ShowtimeCandidate> eligibleCandidates,
            List<ShowtimeCandidate> selectedCandidates) {
        List<String> blockers = new ArrayList<>();
        ShowtimeAllocationPolicy policy = run.getPolicy();
        Map<Key, Long> selectedCount = selectedCandidates.stream()
                .collect(Collectors.groupingBy(Key::from, Collectors.counting()));
        Set<Key> expectedKeys = eligibleCandidates.stream().map(Key::from)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        for (Key key : expectedKeys) {
            Optional<CinemaClusterDemandProfile> profile = profileRepository.findByCluster_ClusterId(key.clusterId());
            if (profile.isEmpty()) continue;
            int required = Math.min(
                    Math.max(policy.getMinimumCoverage(), profile.get().getMinDailyShows()),
                    profile.get().getMaxDailyShowsPerMovie());
            long actual = selectedCount.getOrDefault(key, 0L);
            if (actual < required) {
                blockers.add("MINIMUM_COVERAGE: movie=%d cluster=%d date=%s required=%d actual=%d"
                        .formatted(key.movieId(), key.clusterId(), key.date(), required, actual));
            }
        }

        Map<Long, List<ShowtimeCandidate>> byRoom = selectedCandidates.stream()
                .collect(Collectors.groupingBy(ShowtimeCandidate::getCinemaRoomId));
        byRoom.values().forEach(slots -> {
            List<ShowtimeCandidate> sorted = slots.stream()
                    .sorted(Comparator.comparing(ShowtimeCandidate::temporalStartAt)).toList();
            for (int index = 1; index < sorted.size(); index++) {
                ShowtimeCandidate previous = sorted.get(index - 1);
                ShowtimeCandidate current = sorted.get(index);
                if (current.temporalStartAt().isBefore(previous.temporalEndAt()
                        .plusMinutes(policy.getCleanupBufferMinutes()))) {
                    blockers.add("ROOM_OVERLAP: room=%d date=%s".formatted(
                            current.getCinemaRoomId(), current.getShowDate()));
                }
            }
        });

        selectedCandidates.forEach(candidate -> {
            SchedulingEligibilityResult operational = operationalConstraintService.evaluate(candidate);
            if (!operational.eligible()) {
                blockers.add("OPERATIONAL_ELIGIBILITY: room=%d date=%s reasons=%s".formatted(
                        candidate.getCinemaRoomId(), candidate.getShowDate(),
                        String.join(",", operational.reasonCodes())));
            }
        });

        validateConcurrentRoomShare(policy, eligibleCandidates, selectedCandidates, blockers);
        validateSameMovieStagger(policy, selectedCandidates, blockers);
        return new AutoShowtimePlanValidationResult(blockers);
    }

    private void validateConcurrentRoomShare(
            ShowtimeAllocationPolicy policy,
            List<ShowtimeCandidate> eligibleCandidates,
            List<ShowtimeCandidate> selectedCandidates,
            List<String> blockers
    ) {
        Map<ClusterDayKey, Integer> availableRooms = eligibleCandidates.stream()
                .collect(Collectors.groupingBy(
                        ClusterDayKey::from,
                        Collectors.collectingAndThen(
                                Collectors.mapping(ShowtimeCandidate::getCinemaRoomId, Collectors.toSet()),
                                Set::size)));
        Set<String> uniqueBlockers = new LinkedHashSet<>();

        for (ShowtimeCandidate candidate : selectedCandidates) {
            int roomCount = availableRooms.getOrDefault(ClusterDayKey.from(candidate), 0);
            int maximum = maximumConcurrentRooms(policy.getMaximumRoomShare(), roomCount);
            long concurrentRooms = selectedCandidates.stream()
                    .filter(other -> other.getMovieId().equals(candidate.getMovieId()))
                    .filter(other -> other.getClusterId().equals(candidate.getClusterId()))
                    .filter(other -> other.getShowDate().equals(candidate.getShowDate()))
                    .filter(other -> intervalsOverlap(other, candidate))
                    .map(ShowtimeCandidate::getCinemaRoomId)
                    .distinct()
                    .count();
            if (concurrentRooms > maximum) {
                uniqueBlockers.add("MAXIMUM_CONCURRENT_ROOM_SHARE: movie=%d cluster=%d date=%s max=%d actual=%d"
                        .formatted(candidate.getMovieId(), candidate.getClusterId(), candidate.getShowDate(),
                                maximum, concurrentRooms));
            }
        }
        blockers.addAll(uniqueBlockers);
    }

    private void validateSameMovieStagger(
            ShowtimeAllocationPolicy policy,
            List<ShowtimeCandidate> selectedCandidates,
            List<String> blockers
    ) {
        int requiredMinutes = policy.getSameMovieStaggerMinutes() == null
                ? 0 : policy.getSameMovieStaggerMinutes();
        if (requiredMinutes <= 0) return;

        Set<String> uniqueBlockers = new LinkedHashSet<>();
        for (int leftIndex = 0; leftIndex < selectedCandidates.size(); leftIndex++) {
            ShowtimeCandidate left = selectedCandidates.get(leftIndex);
            for (int rightIndex = leftIndex + 1; rightIndex < selectedCandidates.size(); rightIndex++) {
                ShowtimeCandidate right = selectedCandidates.get(rightIndex);
                if (!left.getMovieId().equals(right.getMovieId())
                        || !left.getClusterId().equals(right.getClusterId())
                        || !left.getShowDate().equals(right.getShowDate())
                        || left.getCinemaRoomId().equals(right.getCinemaRoomId())) {
                    continue;
                }
                long distance = Math.abs(Duration.between(
                        left.temporalStartAt(), right.temporalStartAt()).toMinutes());
                if (distance < requiredMinutes) {
                    uniqueBlockers.add("SAME_MOVIE_START_STAGGER: movie=%d cluster=%d date=%s required=%d"
                            .formatted(left.getMovieId(), left.getClusterId(), left.getShowDate(), requiredMinutes));
                }
            }
        }
        blockers.addAll(uniqueBlockers);
    }

    private int maximumConcurrentRooms(BigDecimal share, int availableRoomCount) {
        if (availableRoomCount <= 0) return 0;
        return Math.max(1, share.multiply(BigDecimal.valueOf(availableRoomCount))
                .setScale(0, RoundingMode.FLOOR).intValue());
    }

    private boolean intervalsOverlap(ShowtimeCandidate left, ShowtimeCandidate right) {
        return left.temporalStartAt().isBefore(right.temporalEndAt())
                && right.temporalStartAt().isBefore(left.temporalEndAt());
    }

    private record Key(Long movieId, Long clusterId, LocalDate date) {
        static Key from(ShowtimeCandidate candidate) {
            return new Key(candidate.getMovieId(), candidate.getClusterId(), candidate.getShowDate());
        }
    }

    private record ClusterDayKey(Long clusterId, LocalDate date) {
        static ClusterDayKey from(ShowtimeCandidate candidate) {
            return new ClusterDayKey(candidate.getClusterId(), candidate.getShowDate());
        }
    }
}
