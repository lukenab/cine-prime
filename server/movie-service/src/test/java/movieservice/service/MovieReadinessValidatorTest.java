package movieservice.service;

import movie.theater.common.exception.AppException;
import movieservice.entity.AgeRating;
import movieservice.entity.Genre;
import movieservice.entity.Movie;
import movieservice.entity.MovieTranslation;
import movieservice.entity.ScreeningFormat;
import movieservice.enums.GenreStatus;
import movieservice.enums.MovieStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.exception.MovieReadinessException;
import movieservice.repository.ShowTimeRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

/**
 * MOV-03: unit tests for MovieReadinessValidator's 3 gates in isolation, independent of
 * MovieService wiring (see MovieServiceTest for the wiring-level tests).
 */
@ExtendWith(MockitoExtension.class)
class MovieReadinessValidatorTest {

    @Mock ShowTimeRepository showTimeRepository;

    private static final LocalDate TODAY = LocalDate.of(2026, 7, 15);
    private final Clock fixedClock = Clock.fixed(
            TODAY.atStartOfDay(ZoneOffset.UTC).toInstant(), ZoneOffset.UTC);

    private MovieReadinessValidator validator(boolean requireShowtimeForRelease) {
        return new MovieReadinessValidator(showTimeRepository, fixedClock, requireShowtimeForRelease);
    }

    private Genre activeGenre() {
        return Genre.builder().genreId(1L).genreName("Action").genreCode("action")
                .status(GenreStatus.ACTIVE).build();
    }

    private ScreeningFormat format() {
        return ScreeningFormat.builder().formatId(1).formatCode("2D").formatName("2D").build();
    }

    private AgeRating activeRating(String code) {
        return AgeRating.builder().ratingId(1).ratingCode(code).minAge(0).description("desc").build();
    }

    /** A movie that fully satisfies every gate, so tests can flip one field at a time. */
    private Movie completeMovie() {
        return Movie.builder()
                .movieId(1L)
                .originalTitle("Dune: Part Two")
                .originalLanguage("en")
                .durationMinutes(166)
                .releaseDate(TODAY.minusDays(1))
                .endDate(TODAY.plusDays(30))
                .genres(List.of(activeGenre()))
                .formats(List.of(format()))
                .ageRating(activeRating("T13"))
                .posterUrl("https://example.com/poster.jpg")
                .synopsis("A synopsis.")
                .translations(List.of(MovieTranslation.builder().title("Hành Tinh Cát").build()))
                .status(MovieStatus.DRAFT)
                .build();
    }

    // ── requireValidDateRange ──────────────────────────────────

    @Test
    void requireValidDateRangeThrowsWhenReleaseAfterEnd() {
        MovieReadinessValidator v = validator(false);
        AppException ex = assertThrows(AppException.class,
                () -> v.requireValidDateRange(TODAY.plusDays(5), TODAY));
        assertEquals(MovieErrorCode.INVALID_MOVIE_DATE_RANGE, ex.getErrorCode());
    }

    @Test
    void requireValidDateRangePassesWhenOneOrBothDatesMissingOrValid() {
        MovieReadinessValidator v = validator(false);
        assertDoesNotThrow(() -> v.requireValidDateRange(null, null));
        assertDoesNotThrow(() -> v.requireValidDateRange(TODAY, null));
        assertDoesNotThrow(() -> v.requireValidDateRange(null, TODAY));
        assertDoesNotThrow(() -> v.requireValidDateRange(TODAY, TODAY.plusDays(1)));
    }

    // ── Submit / review gate ───────────────────────────────────

    @Test
    void reviewGatePassesForACompleteMovie() {
        assertDoesNotThrow(() -> validator(false).requireReadyForReview(completeMovie()));
    }

    @Test
    void reviewGateBlocksOnMissingRequiredFields() {
        Movie movie = Movie.builder()
                .movieId(2L)
                .originalTitle("")
                .originalLanguage("english")
                .durationMinutes(0)
                .genres(List.of())
                .formats(List.of())
                .build();

        MovieReadinessException ex = assertThrows(MovieReadinessException.class,
                () -> validator(false).requireReadyForReview(movie));

        assertEquals(MovieErrorCode.MOVIE_NOT_READY_FOR_REVIEW, ex.getErrorCode());
        List<String> fields = ex.getViolations().stream().map(v -> v.getField()).toList();
        assertTrue(fields.contains("originalTitle"));
        assertTrue(fields.contains("originalLanguage"));
        assertTrue(fields.contains("durationMinutes"));
        assertTrue(fields.contains("genres"));
        assertTrue(fields.contains("formats"));
        // All violations reported together, not fail-fast on the first one.
        assertEquals(5, fields.size());
    }

    @Test
    void reviewGateBlocksOnInvertedDateRange() {
        Movie movie = completeMovie();
        movie.setReleaseDate(TODAY.plusDays(10));
        movie.setEndDate(TODAY.plusDays(5));

        MovieReadinessException ex = assertThrows(MovieReadinessException.class,
                () -> validator(false).requireReadyForReview(movie));
        assertTrue(ex.getViolations().stream().anyMatch(v -> "releaseDate".equals(v.getField())));
    }

    // ── Approve gate ───────────────────────────────────────────

    @Test
    void approvalGatePassesForACompleteMovie() {
        assertDoesNotThrow(() -> validator(false).requireReadyForApproval(completeMovie()));
    }

    @Test
    void approvalGateBlocksOnMissingAgeRatingPosterSynopsisAndTranslation() {
        Movie movie = completeMovie();
        movie.setAgeRating(null);
        movie.setPosterUrl(null);
        movie.setSynopsis(" ");
        movie.setTranslations(List.of());

        MovieReadinessException ex = assertThrows(MovieReadinessException.class,
                () -> validator(false).requireReadyForApproval(movie));

        assertEquals(MovieErrorCode.MOVIE_NOT_READY_FOR_APPROVAL, ex.getErrorCode());
        List<String> fields = ex.getViolations().stream().map(v -> v.getField()).toList();
        assertTrue(fields.contains("ageRating"));
        assertTrue(fields.contains("poster"));
        assertTrue(fields.contains("synopsis"));
        assertTrue(fields.contains("translations"));
    }

    @Test
    void approvalGateBlocksOnClassificationC() {
        Movie movie = completeMovie();
        movie.setAgeRating(activeRating("C"));

        MovieReadinessException ex = assertThrows(MovieReadinessException.class,
                () -> validator(false).requireReadyForApproval(movie));
        assertTrue(ex.getViolations().stream()
                .anyMatch(v -> "ageRating".equals(v.getField())
                        && "CLASSIFICATION_C_BANNED_FROM_PUBLIC_RELEASE".equals(v.getRule())));
    }

    @Test
    void approvalGateBlocksOnPendingReviewGenre() {
        Movie movie = completeMovie();
        movie.setGenres(List.of(Genre.builder().genreId(2L).genreName("New Genre").genreCode("TMDB_1")
                .status(GenreStatus.PENDING_REVIEW).build()));

        MovieReadinessException ex = assertThrows(MovieReadinessException.class,
                () -> validator(false).requireReadyForApproval(movie));
        assertTrue(ex.getViolations().stream()
                .anyMatch(v -> "genres".equals(v.getField())
                        && "PENDING_REVIEW_GENRE_MUST_BE_RESOLVED".equals(v.getRule())));
    }

    // ── Release gate ───────────────────────────────────────────

    @Test
    void releaseGatePassesForACompleteMovieWhenShowtimePolicyDisabled() {
        assertDoesNotThrow(() -> validator(false).requireReadyForRelease(completeMovie()));
    }

    @Test
    void releaseGateBlocksWhenReleaseDateNotReached() {
        Movie movie = completeMovie();
        movie.setReleaseDate(TODAY.plusDays(1));

        MovieReadinessException ex = assertThrows(MovieReadinessException.class,
                () -> validator(false).requireReadyForRelease(movie));
        assertEquals(MovieErrorCode.MOVIE_NOT_READY_FOR_RELEASE, ex.getErrorCode());
        assertTrue(ex.getViolations().stream()
                .anyMatch(v -> "releaseDate".equals(v.getField()) && "RELEASE_DATE_NOT_REACHED".equals(v.getRule())));
    }

    @Test
    void releaseGateBlocksWhenAlreadyPastEndDate() {
        Movie movie = completeMovie();
        movie.setEndDate(TODAY.minusDays(1));

        MovieReadinessException ex = assertThrows(MovieReadinessException.class,
                () -> validator(false).requireReadyForRelease(movie));
        assertTrue(ex.getViolations().stream()
                .anyMatch(v -> "endDate".equals(v.getField()) && "ALREADY_PAST_END_DATE".equals(v.getRule())));
    }

    @Test
    void releaseGateBlocksWhenPolicyRequiresShowtimeButNoneExists() {
        when(showTimeRepository.existsByMovieMovieIdAndFutureNonCancelledShowTime(
                anyLong(), any(), any())).thenReturn(false);

        MovieReadinessException ex = assertThrows(MovieReadinessException.class,
                () -> validator(true).requireReadyForRelease(completeMovie()));
        assertTrue(ex.getViolations().stream()
                .anyMatch(v -> "showTimes".equals(v.getField())));
    }

    @Test
    void releaseGatePassesWhenPolicyRequiresShowtimeAndOneExists() {
        when(showTimeRepository.existsByMovieMovieIdAndFutureNonCancelledShowTime(
                anyLong(), any(), any())).thenReturn(true);

        assertDoesNotThrow(() -> validator(true).requireReadyForRelease(completeMovie()));
    }
}
