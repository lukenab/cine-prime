package movieservice.service.autoshowtime;

import lombok.RequiredArgsConstructor;
import movieservice.entity.Movie;
import movieservice.entity.ProgrammingSharePolicy;
import movieservice.entity.ShowtimeGenerationRun;
import movieservice.enums.ProgrammingShareMeasurementBasis;
import movieservice.repository.MovieRepository;
import movieservice.repository.ProgrammingSharePolicyRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.util.*;
import java.util.function.Predicate;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class VietnameseFilmShareService {
    private static final String MARKET = "VN";
    private final ProgrammingSharePolicyRepository policyRepository;
    private final MovieRepository movieRepository;

    public List<ShowtimeCandidate> prioritize(ShowtimeGenerationRun run, List<ShowtimeCandidate> ranked) {
        Optional<ProgrammingSharePolicy> policy = applicablePolicy(run);
        if (policy.isEmpty()) return ranked;
        Set<Long> domesticMovieIds = domesticMovieIds(ranked);
        List<ShowtimeCandidate> result = new ArrayList<>(ranked.size());
        ranked.stream().filter(candidate -> domesticMovieIds.contains(candidate.getMovieId())).forEach(result::add);
        ranked.stream().filter(candidate -> !domesticMovieIds.contains(candidate.getMovieId())).forEach(result::add);
        return result;
    }

    public AutoShowtimePlanValidationResult validate(
            ShowtimeGenerationRun run, List<ShowtimeCandidate> selected) {
        Optional<ProgrammingSharePolicy> configured = applicablePolicy(run);
        if (configured.isEmpty() || selected.isEmpty()) {
            return new AutoShowtimePlanValidationResult(List.of());
        }
        ProgrammingSharePolicy policy = configured.get();
        Set<Long> domesticMovieIds = domesticMovieIds(selected);
        List<String> blockers = new ArrayList<>();

        selected.stream().collect(Collectors.groupingBy(ShowtimeCandidate::getClusterId))
                .forEach((clusterId, slots) -> {
                    BigDecimal total = measure(slots, candidate -> true, policy.getMeasurementBasis());
                    BigDecimal domestic = measure(slots,
                            candidate -> domesticMovieIds.contains(candidate.getMovieId()),
                            policy.getMeasurementBasis());
                    BigDecimal actual = total.signum() == 0 ? BigDecimal.ZERO
                            : domestic.divide(total, 4, RoundingMode.HALF_UP);
                    if (Boolean.TRUE.equals(policy.getHardEnforcement())
                            && actual.compareTo(policy.getRequiredShare()) < 0) {
                        blockers.add("VIETNAMESE_FILM_SHARE: policy=%s cluster=%d basis=%s required=%s actual=%s"
                                .formatted(policy.getPolicyCode(), clusterId, policy.getMeasurementBasis(),
                                        policy.getRequiredShare(), actual));
                    }
                });
        return new AutoShowtimePlanValidationResult(blockers);
    }

    private Optional<ProgrammingSharePolicy> applicablePolicy(ShowtimeGenerationRun run) {
        return policyRepository.findApplicable(MARKET, run.getStartDate(), run.getEndDate());
    }

    private Set<Long> domesticMovieIds(List<ShowtimeCandidate> candidates) {
        Set<Long> ids = candidates.stream().map(ShowtimeCandidate::getMovieId).collect(Collectors.toSet());
        return movieRepository.findAllById(ids).stream()
                .filter(movie -> Boolean.TRUE.equals(movie.getDomesticProductionVerified()))
                .map(Movie::getMovieId).collect(Collectors.toSet());
    }

    private BigDecimal measure(List<ShowtimeCandidate> candidates, Predicate<ShowtimeCandidate> filter,
                               ProgrammingShareMeasurementBasis basis) {
        if (basis == ProgrammingShareMeasurementBasis.SHOW_COUNT) {
            return BigDecimal.valueOf(candidates.stream().filter(filter).count());
        }
        long minutes = candidates.stream().filter(filter)
                .mapToLong(candidate -> Duration.between(
                        candidate.temporalStartAt(), candidate.temporalEndAt()).toMinutes()).sum();
        return BigDecimal.valueOf(minutes);
    }
}
