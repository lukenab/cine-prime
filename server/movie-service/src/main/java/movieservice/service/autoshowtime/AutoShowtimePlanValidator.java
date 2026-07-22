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

@Service
@RequiredArgsConstructor
public class AutoShowtimePlanValidator {
    private final CinemaClusterDemandProfileRepository profileRepository;

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

        Map<RoomDayKey, List<ShowtimeCandidate>> byRoomDay = selectedCandidates.stream()
                .collect(Collectors.groupingBy(RoomDayKey::from));
        byRoomDay.values().forEach(slots -> {
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
        return new AutoShowtimePlanValidationResult(blockers);
    }

    private record Key(Long movieId, Long clusterId, LocalDate date) {
        static Key from(ShowtimeCandidate candidate) {
            return new Key(candidate.getMovieId(), candidate.getClusterId(), candidate.getShowDate());
        }
    }

    private record RoomDayKey(Long roomId, LocalDate date) {
        static RoomDayKey from(ShowtimeCandidate candidate) {
            return new RoomDayKey(candidate.getCinemaRoomId(), candidate.getShowDate());
        }
    }
}
