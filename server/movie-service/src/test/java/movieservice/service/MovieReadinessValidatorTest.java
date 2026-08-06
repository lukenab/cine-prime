package movieservice.service;

import movie.theater.common.exception.AppException;
import movieservice.entity.AgeRating;
import movieservice.entity.Genre;
import movieservice.entity.Movie;
import movieservice.entity.MovieTranslation;
import movieservice.entity.MovieTranslationId;
import movieservice.entity.ScreeningFormat;
import movieservice.enums.GenreStatus;
import movieservice.enums.MovieStatus;
import movieservice.enums.ScreeningVersionStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.exception.MovieReadinessException;
import movieservice.repository.ShowTimeRepository;
import movieservice.repository.MovieScreeningVersionRepository;
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
import static org.mockito.Mockito.lenient;

/**
 * MOV-03: unit tests for MovieReadinessValidator's 3 gates in isolation, independent of
 * MovieService wiring (see MovieServiceTest for the wiring-level tests).
 */
@ExtendWith(MockitoExtension.class)
class MovieReadinessValidatorTest {

    @Mock ShowTimeRepository showTimeRepository;
    @Mock MovieScreeningVersionRepository movieScreeningVersionRepository;

    private static final LocalDate TODAY = LocalDate.of(2026, 7, 15);
    private final Clock fixedClock = Clock.fixed(
            TODAY.atStartOfDay(ZoneOffset.UTC).toInstant(), ZoneOffset.UTC);

    private MovieReadinessValidator validator(boolean requireShowtimeForRelease) {
        lenient().when(movieScreeningVersionRepository
                .existsByMovie_MovieIdAndStatusAndAudioFormatIsNotNull(
                        org.mockito.ArgumentMatchers.eq(1L),
                        org.mockito.ArgumentMatchers.eq(ScreeningVersionStatus.ACTIVE)))
                .thenReturn(true);
        return new MovieReadinessValidator(
                showTimeRepository,
                movieScreeningVersionRepository,
                fixedClock,
                requireShowtimeForRelease);
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
                .genres(List.of(activeGenre()))
                .formats(List.of(format()))
                .ageRating(activeRating("T13"))
                .posterUrl("https://example.com/poster.jpg")
                .synopsis("A synopsis.")
                .translations(List.of(MovieTranslation.builder()
                        .id(new MovieTranslationId(1L, "vi"))
                        .title("Hành Tinh Cát")
                        .build()))
                .status(MovieStatus.DRAFT)
                .build();
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
        when(movieScreeningVersionRepository
                .existsByMovie_MovieIdAndStatusAndAudioFormatIsNotNull(
                        2L, ScreeningVersionStatus.ACTIVE))
                .thenReturn(false);

        MovieReadinessException ex = assertThrows(MovieReadinessException.class,
                () -> validator(false).requireReadyForReview(movie));

        assertEquals(MovieErrorCode.MOVIE_NOT_READY_FOR_REVIEW, ex.getErrorCode());
        List<String> fields = ex.getViolations().stream().map(v -> v.getField()).toList();
        assertTrue(fields.contains("originalTitle"));
        assertTrue(fields.contains("originalLanguage"));
        assertTrue(fields.contains("durationMinutes"));
        assertTrue(fields.contains("genres"));
        assertTrue(fields.contains("translations.vi"));
        assertTrue(fields.contains("screeningVersions"));
        // All violations reported together, not fail-fast on the first one.
        assertEquals(6, fields.size());
    }

    // ── Approve gate ───────────────────────────────────────────

    @Test
    void approvalGatePassesForACompleteMovie() {
        assertDoesNotThrow(() -> validator(false).requireReadyForApproval(completeMovie()));
    }

    @Test
    void approvalGateAcceptsTranslatedSynopsisWhenCanonicalSynopsisIsMissing() {
        Movie movie = completeMovie();
        movie.setSynopsis(null);
        movie.setTranslations(List.of(MovieTranslation.builder()
                .id(new MovieTranslationId(1L, "vi"))
                .title("Am Anh")
                .synopsis("A localized synopsis.")
                .build()));

        assertDoesNotThrow(() -> validator(false).requireReadyForApproval(movie));
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
