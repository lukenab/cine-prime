package movieservice.service;

import movie.theater.common.exception.AppException;
import movieservice.dto.response.ReadinessViolation;
import movieservice.entity.Genre;
import movieservice.entity.Movie;
import movieservice.entity.MovieTranslation;
import movieservice.enums.GenreStatus;
import movieservice.enums.ScreeningVersionStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.exception.MovieReadinessException;
import movieservice.repository.MovieScreeningVersionRepository;
import movieservice.repository.ShowTimeRepository;
import movieservice.util.MovieTitleResolver;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

/**
 * MOV-03: gates for the DRAFT -> PENDING_REVIEW -> COMING_SOON -> NOW_SHOWING transitions.
 * A single shared component (not baked into create/update DTO validation, since DRAFT/PENDING_REVIEW
 * are allowed to be incomplete) called from MovieService's submit/approve/release methods. Each gate
 * collects every unmet rule instead of failing on the first one, so the admin can fix everything in
 * one pass instead of resubmitting repeatedly.
 */
@Component
public class MovieReadinessValidator {

    private final ShowTimeRepository showTimeRepository;
    private final MovieScreeningVersionRepository movieScreeningVersionRepository;
    private final Clock clock;
    private final boolean requireShowtimeForRelease;

    public MovieReadinessValidator(
            ShowTimeRepository showTimeRepository,
            MovieScreeningVersionRepository movieScreeningVersionRepository,
            Clock clock,
            @Value("${movie.readiness.require-showtime-for-release:false}") boolean requireShowtimeForRelease) {
        this.showTimeRepository = showTimeRepository;
        this.movieScreeningVersionRepository = movieScreeningVersionRepository;
        this.clock = clock;
        this.requireShowtimeForRelease = requireShowtimeForRelease;
    }

    public void requireReadyForReview(Movie movie) {
        List<ReadinessViolation> violations = collectReviewViolations(movie);
        if (!violations.isEmpty()) {
            throw new MovieReadinessException(MovieErrorCode.MOVIE_NOT_READY_FOR_REVIEW, violations);
        }
    }

    public void requireReadyForApproval(Movie movie) {
        List<ReadinessViolation> violations = collectReviewViolations(movie);
        violations.addAll(collectApprovalOnlyViolations(movie));
        if (!violations.isEmpty()) {
            throw new MovieReadinessException(MovieErrorCode.MOVIE_NOT_READY_FOR_APPROVAL, violations);
        }
    }

    public void requireReadyForRelease(Movie movie) {
        List<ReadinessViolation> violations = collectReviewViolations(movie);
        violations.addAll(collectApprovalOnlyViolations(movie));
        violations.addAll(collectReleaseOnlyViolations(movie));
        if (!violations.isEmpty()) {
            throw new MovieReadinessException(MovieErrorCode.MOVIE_NOT_READY_FOR_RELEASE, violations);
        }
    }

    // ── Submit gate: title, original language, runtime > 0, genre, format, basic date range ──

    private List<ReadinessViolation> collectReviewViolations(Movie movie) {
        List<ReadinessViolation> violations = new ArrayList<>();

        if (isBlank(movie.getOriginalTitle())) {
            violations.add(violation("originalTitle", "REQUIRED"));
        }
        if (isBlank(movie.getOriginalLanguage()) || !movie.getOriginalLanguage().matches("[a-zA-Z]{2}")) {
            violations.add(violation("originalLanguage", "MUST_BE_TWO_LETTER_CODE"));
        }
        if (movie.getDurationMinutes() == null || movie.getDurationMinutes() <= 0) {
            violations.add(violation("durationMinutes", "MUST_BE_POSITIVE"));
        }
        if (movie.getGenres() == null || movie.getGenres().isEmpty()) {
            violations.add(violation("genres", "AT_LEAST_ONE_REQUIRED"));
        }
        if (!MovieTitleResolver.hasVietnameseDisplayTitle(movie)) {
            violations.add(violation("translations.vi", "VIETNAMESE_TITLE_REQUIRED"));
        }
        boolean hasCompleteActiveVersion = movie.getMovieId() != null
                && movieScreeningVersionRepository
                .existsByMovie_MovieIdAndStatusAndAudioFormatIsNotNull(
                        movie.getMovieId(), ScreeningVersionStatus.ACTIVE);
        if (!hasCompleteActiveVersion) {
            violations.add(violation(
                    "screeningVersions",
                    "AT_LEAST_ONE_COMPLETE_ACTIVE_VERSION_REQUIRED"));
        }
        return violations;
    }

    // ── Approve gate: age classification, primary image, synopsis/localized title, valid refs ──

    private List<ReadinessViolation> collectApprovalOnlyViolations(Movie movie) {
        List<ReadinessViolation> violations = new ArrayList<>();

        if (movie.getAgeRating() == null) {
            violations.add(violation("ageRating", "REQUIRED_FOR_APPROVAL"));
        } else if ("C".equals(movie.getAgeRating().getRatingCode())) {
            violations.add(violation("ageRating", "CLASSIFICATION_C_BANNED_FROM_PUBLIC_RELEASE"));
        }
        if (isBlank(movie.getPosterUrl())) {
            violations.add(violation("poster", "PRIMARY_IMAGE_REQUIRED"));
        }
        List<MovieTranslation> translations = movie.getTranslations();
        boolean hasSynopsis = !isBlank(movie.getSynopsis())
                || (translations != null && translations.stream()
                .anyMatch(t -> !isBlank(t.getSynopsis())));
        if (!hasSynopsis) {
            violations.add(violation("synopsis", "REQUIRED_FOR_APPROVAL"));
        }
        boolean hasLocalizedTitle = translations != null && translations.stream()
                .anyMatch(t -> t.getTitle() != null && !t.getTitle().isBlank());
        if (!hasLocalizedTitle) {
            violations.add(violation("translations", "LOCALIZED_TITLE_REQUIRED"));
        }
        List<Genre> genres = movie.getGenres();
        boolean hasPendingGenre = genres != null && genres.stream()
                .anyMatch(g -> g.getStatus() == GenreStatus.PENDING_REVIEW);
        if (hasPendingGenre) {
            violations.add(violation("genres", "PENDING_REVIEW_GENRE_MUST_BE_RESOLVED"));
        }
        return violations;
    }

    // ── Release gate: approved state (checked by caller), release window, showtime policy ──

    private List<ReadinessViolation> collectReleaseOnlyViolations(Movie movie) {
        List<ReadinessViolation> violations = new ArrayList<>();
        LocalDate today = LocalDate.now(clock);

        if (movie.getReleaseDate() != null && today.isBefore(movie.getReleaseDate())) {
            violations.add(violation("releaseDate", "RELEASE_DATE_NOT_REACHED"));
        }
        if (requireShowtimeForRelease) {
            boolean hasFutureShowtime = showTimeRepository.existsByMovieMovieIdAndFutureNonCancelledShowTime(
                    movie.getMovieId(), today, LocalTime.now(clock));
            if (!hasFutureShowtime) {
                violations.add(violation("showTimes", "AT_LEAST_ONE_FUTURE_SHOWTIME_REQUIRED"));
            }
        }
        return violations;
    }

    private static ReadinessViolation violation(String field, String rule) {
        return ReadinessViolation.builder().field(field).rule(rule).build();
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
