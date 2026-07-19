package movieservice.service;

import movie.theater.common.exception.AppException;
import movieservice.dto.request.CastRequest;
import movieservice.dto.request.CreateMovieRequest;
import movieservice.dto.request.TranslationRequest;
import movieservice.dto.request.UpdateMovieRequest;
import movieservice.entity.*;
import movieservice.enums.AvailabilityStatus;
import movieservice.enums.GenreStatus;
import movieservice.enums.MovieStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.exception.MovieReadinessException;
import movieservice.mapper.MovieMapper;
import movieservice.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

/**
 * Issue #143 - MovieService.updateMovie() reconciliation contract.
 * Khong dung @InjectMocks vi MovieService co qua nhieu dependency khong lien quan (CinemaRoomService,
 * ShowTimeService, AuditLogService, ImageStorageService...) - khoi tao thu cong bang constructor
 * @RequiredArgsConstructor sinh ra de test doc/ro rang hon ve dependency nao thuc su can cho updateMovie().
 */
@ExtendWith(MockitoExtension.class)
class MovieServiceTest {

    @Mock MovieRepository movieRepository;
    @Mock MovieMapper movieMapper;
    @Mock GenreRepository genreRepository;
    @Mock AgeRatingRepository ageRatingRepository;
    @Mock ScreeningFormatRepository screeningFormatRepository;
    @Mock ProductionCompanyRepository productionCompanyRepository;
    @Mock PersonRepository personRepository;
    @Mock MovieCastRepository movieCastRepository;
    @Mock MovieTranslationRepository movieTranslationRepository;
    @Mock CinemaRoomService cinemaRoomService;
    @Mock ShowTimeService showTimeService;
    @Mock AuditLogService auditLogService;
    @Mock ImageStorageService imageStorageService;
    @Mock MovieReadinessValidator movieReadinessValidator;
    @Mock MovieAvailabilityRepository movieAvailabilityRepository;
    @Mock MovieStatusHistoryRepository movieStatusHistoryRepository;

    private MovieService movieService;
    private Movie movie;

    @BeforeEach
    void setUp() {
        movieService = new MovieService(
                movieRepository, movieMapper, genreRepository, ageRatingRepository,
                screeningFormatRepository, productionCompanyRepository, personRepository,
                movieCastRepository, movieTranslationRepository, cinemaRoomService,
                showTimeService, auditLogService, imageStorageService, movieReadinessValidator,
                movieAvailabilityRepository, movieStatusHistoryRepository);

        movie = Movie.builder().movieId(1L).originalTitle("Existing Movie").build();
        // lenient(): cac test kiem tra "throw truoc khi mutate" khong bao gio toi duoc dong
        // save()/toMovieResponse() (exception nem ra som hon) - khong dung lenient() se bi
        // Mockito strict-stubbing bao UnnecessaryStubbingException oan cho chinh nhung test do.
        // findById(1L) cung lenient() vi cac test createMovie() moi khong dong toi ID nay.
        lenient().when(movieRepository.findById(1L)).thenReturn(java.util.Optional.of(movie));
        lenient().when(movieRepository.save(any(Movie.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(movieMapper.toMovieResponse(any())).thenReturn(null);
    }

    // ── Null / missing collections: khong duoc dong toi repository nao ──────

    @Test
    void nullCollectionsAndNullFkDoNotTouchAnyRelationshipRepository() {
        UpdateMovieRequest request = UpdateMovieRequest.builder()
                .originalTitle("Only scalar changed")
                .build(); // ageRatingId, companyIds, genreIds, formatIds, translations, cast: null

        movieService.updateMovie(1L, request);

        verifyNoInteractions(ageRatingRepository, productionCompanyRepository,
                genreRepository, screeningFormatRepository,
                movieCastRepository, movieTranslationRepository, personRepository);
    }

    // ── Genre / format duplicate-ID normalization ────────────────────────────

    @Test
    void duplicateGenreIdsInRequestAreNormalizedNotRejected() {
        Genre genre1 = Genre.builder().genreId(1L).genreName("Action").build();
        Genre genre2 = Genre.builder().genreId(2L).genreName("Drama").build();
        when(genreRepository.findAllByGenreIdIn(List.of(1L, 2L))).thenReturn(List.of(genre1, genre2));

        // Request gui trung ID (1,1,2) - truoc fix se bi GENRE_NOT_FOUND oan vi repository chi
        // tra ve 2 genre phan biet trong khi request.size() == 3.
        UpdateMovieRequest request = UpdateMovieRequest.builder()
                .genreIds(List.of(1L, 1L, 2L))
                .build();

        assertDoesNotThrow(() -> movieService.updateMovie(1L, request));
        assertEquals(List.of(genre1, genre2), movie.getGenres());
    }

    // ── Issue #151: multi-company partial-update semantics ──────────────────

    @Test
    void duplicateCompanyIdsInRequestAreNormalizedNotRejected() {
        ProductionCompany c1 = ProductionCompany.builder().companyId(1L).name("Legendary").build();
        ProductionCompany c2 = ProductionCompany.builder().companyId(2L).name("Warner Bros.").build();
        when(productionCompanyRepository.findAllByCompanyIdIn(List.of(1L, 2L))).thenReturn(List.of(c1, c2));

        UpdateMovieRequest request = UpdateMovieRequest.builder()
                .companyIds(List.of(1L, 1L, 2L))
                .build();

        assertDoesNotThrow(() -> movieService.updateMovie(1L, request));
        assertEquals(List.of(c1, c2), movie.getCompanies());
    }

    @Test
    void emptyCompanyIdsListClearsAllCompanies() {
        movie.setCompanies(List.of(ProductionCompany.builder().companyId(1L).name("Legendary").build()));

        UpdateMovieRequest request = UpdateMovieRequest.builder()
                .companyIds(List.of())
                .build();

        movieService.updateMovie(1L, request);

        assertTrue(movie.getCompanies().isEmpty());
        verifyNoInteractions(productionCompanyRepository);
    }

    @Test
    void unknownCompanyIdIsRejected() {
        when(productionCompanyRepository.findAllByCompanyIdIn(List.of(999L))).thenReturn(List.of());

        UpdateMovieRequest request = UpdateMovieRequest.builder()
                .companyIds(List.of(999L))
                .build();

        AppException ex = assertThrows(AppException.class, () -> movieService.updateMovie(1L, request));
        assertEquals(MovieErrorCode.COMPANY_NOT_FOUND, ex.getErrorCode());
    }

    // ── `[Backend] Separate public and internal movie catalog APIs` ─────────
    // getPublicMovieDetail() must apply the exact same visibility predicate as the public
    // list: a movie that wouldn't appear in GET /api/movies/public must 404 (not a different
    // error) when its ID is guessed directly at GET /api/movies/public/{id}.

    private MovieAvailability availabilityFor(Movie movie, AvailabilityStatus status, LocalDate showingEndDate) {
        return MovieAvailability.builder()
                .availabilityId(1L)
                .movie(movie)
                .cluster(CinemaCluster.builder().clusterId(10L).clusterName("Downtown").build())
                .status(status)
                .showingStartDate(LocalDate.now().minusDays(1))
                .showingEndDate(showingEndDate)
                .build();
    }

    @Test
    void publicDetailReturnsMovieWithAnOpenApprovedAvailability() {
        Movie approved = Movie.builder().movieId(2L).originalTitle("Visible").status(MovieStatus.APPROVED).build();
        when(movieRepository.findById(2L)).thenReturn(java.util.Optional.of(approved));
        when(movieAvailabilityRepository.findByMovie_MovieId(2L))
                .thenReturn(List.of(availabilityFor(approved, AvailabilityStatus.OPEN, null)));
        lenient().when(showTimeService.findNextSaleableShowTime(any(), any(), any(), any()))
                .thenReturn(java.util.Optional.empty());

        var response = movieService.getPublicMovieDetail(2L, null);

        assertEquals(2L, response.getMovieId());
    }

    @Test
    void publicDetailRejectsDraftMovieWithMovieNotFoundNotADifferentError() {
        Movie draft = Movie.builder().movieId(3L).originalTitle("Still Draft").status(MovieStatus.DRAFT).build();
        when(movieRepository.findById(3L)).thenReturn(java.util.Optional.of(draft));
        when(movieAvailabilityRepository.findByMovie_MovieId(3L)).thenReturn(List.of());

        AppException ex = assertThrows(AppException.class, () -> movieService.getPublicMovieDetail(3L, null));
        assertEquals(MovieErrorCode.MOVIE_NOT_FOUND, ex.getErrorCode());
    }

    @Test
    void publicDetailRejectsApprovedMovieWithNoOpenOrPlannedAvailability() {
        // Approved content, but every availability window is SUSPENDED/CLOSED - must still 404.
        Movie approved = Movie.builder().movieId(4L).originalTitle("Approved But Suspended").status(MovieStatus.APPROVED).build();
        when(movieRepository.findById(4L)).thenReturn(java.util.Optional.of(approved));
        when(movieAvailabilityRepository.findByMovie_MovieId(4L))
                .thenReturn(List.of(availabilityFor(approved, AvailabilityStatus.SUSPENDED, null)));

        AppException ex = assertThrows(AppException.class, () -> movieService.getPublicMovieDetail(4L, null));
        assertEquals(MovieErrorCode.MOVIE_NOT_FOUND, ex.getErrorCode());
    }

    @Test
    void publicDetailRejectsAvailabilityWhoseShowingEndDateHasPassed() {
        Movie approved = Movie.builder().movieId(5L).originalTitle("Ended Run").status(MovieStatus.APPROVED).build();
        when(movieRepository.findById(5L)).thenReturn(java.util.Optional.of(approved));
        when(movieAvailabilityRepository.findByMovie_MovieId(5L))
                .thenReturn(List.of(availabilityFor(approved, AvailabilityStatus.OPEN, LocalDate.now().minusDays(1))));

        AppException ex = assertThrows(AppException.class, () -> movieService.getPublicMovieDetail(5L, null));
        assertEquals(MovieErrorCode.MOVIE_NOT_FOUND, ex.getErrorCode());
    }

    @Test
    void publicDetailRejectsWhenAvailabilityExistsOnlyAtADifferentCluster() {
        Movie approved = Movie.builder().movieId(6L).originalTitle("Other Cluster Only").status(MovieStatus.APPROVED).build();
        when(movieRepository.findById(6L)).thenReturn(java.util.Optional.of(approved));
        // availabilityFor() always builds a window at clusterId=10L
        when(movieAvailabilityRepository.findByMovie_MovieId(6L))
                .thenReturn(List.of(availabilityFor(approved, AvailabilityStatus.OPEN, null)));

        AppException ex = assertThrows(AppException.class, () -> movieService.getPublicMovieDetail(6L, 999L));
        assertEquals(MovieErrorCode.MOVIE_NOT_FOUND, ex.getErrorCode());
    }

    @Test
    void publicDetailOfATrulyNonexistentIdIsAlsoMovieNotFound() {
        when(movieRepository.findById(404L)).thenReturn(java.util.Optional.empty());

        AppException ex = assertThrows(AppException.class, () -> movieService.getPublicMovieDetail(404L, null));
        assertEquals(MovieErrorCode.MOVIE_NOT_FOUND, ex.getErrorCode());
        verifyNoInteractions(movieAvailabilityRepository);
    }

    // ── Translation reconciliation ───────────────────────────────────────────

    @Test
    void existingTranslationLanguageIsUpdatedInPlaceNotDeletedAndRecreated() {
        MovieTranslation existingVi = new MovieTranslation();
        existingVi.setId(new MovieTranslationId(1L, "vi"));
        existingVi.setTitle("Ten cu");
        existingVi.setSynopsis("Noi dung cu");
        when(movieTranslationRepository.findById_MovieId(1L)).thenReturn(List.of(existingVi));
        when(movieTranslationRepository.save(any(MovieTranslation.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        UpdateMovieRequest request = UpdateMovieRequest.builder()
                .translations(List.of(TranslationRequest.builder()
                        .languageCode("vi").title("Ten moi").synopsis("Noi dung moi").build()))
                .build();

        movieService.updateMovie(1L, request);

        ArgumentCaptor<MovieTranslation> captor = ArgumentCaptor.forClass(MovieTranslation.class);
        verify(movieTranslationRepository).save(captor.capture());
        assertSame(existingVi, captor.getValue(), "Phai update tai cho cung 1 instance, khong tao entity moi");
        assertEquals("Ten moi", existingVi.getTitle());
        assertEquals("Noi dung moi", existingVi.getSynopsis());
        assertEquals("vi", existingVi.getId().getLanguageCode(), "Composite key khong duoc doi");
        verify(movieTranslationRepository, never()).deleteAll(anyList());
        verify(movieTranslationRepository, never()).deleteById_MovieId(any());
    }

    @Test
    void translationLanguageMissingFromNonEmptyRequestIsDeleted() {
        MovieTranslation existingVi = new MovieTranslation();
        existingVi.setId(new MovieTranslationId(1L, "vi"));
        MovieTranslation existingEn = new MovieTranslation();
        existingEn.setId(new MovieTranslationId(1L, "en"));
        when(movieTranslationRepository.findById_MovieId(1L)).thenReturn(List.of(existingVi, existingEn));
        when(movieTranslationRepository.save(any(MovieTranslation.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // Request chi gui lai "vi" - "en" khong con trong request nen phai bi xoa.
        UpdateMovieRequest request = UpdateMovieRequest.builder()
                .translations(List.of(TranslationRequest.builder()
                        .languageCode("vi").title("Ten moi").build()))
                .build();

        movieService.updateMovie(1L, request);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<MovieTranslation>> captor = ArgumentCaptor.forClass(List.class);
        verify(movieTranslationRepository).deleteAll(captor.capture());
        assertEquals(List.of(existingEn), captor.getValue(), "Chi xoa 'en', 'vi' phai duoc giu lai");
    }

    @Test
    void emptyTranslationsListDeletesAllExisting() {
        MovieTranslation existingVi = new MovieTranslation();
        existingVi.setId(new MovieTranslationId(1L, "vi"));
        when(movieTranslationRepository.findById_MovieId(1L)).thenReturn(List.of(existingVi));

        UpdateMovieRequest request = UpdateMovieRequest.builder()
                .translations(List.of()) // [] khac null - phai xoa toan bo
                .build();

        movieService.updateMovie(1L, request);

        verify(movieTranslationRepository).deleteAll(List.of(existingVi));
        verify(movieTranslationRepository, never()).save(any());
    }

    @Test
    void duplicateLanguageCodeInRequestThrowsBeforeAnyMutation() {
        when(movieTranslationRepository.findById_MovieId(1L)).thenReturn(List.of());

        UpdateMovieRequest request = UpdateMovieRequest.builder()
                .translations(List.of(
                        TranslationRequest.builder().languageCode("vi").title("A").build(),
                        TranslationRequest.builder().languageCode("VI").title("B").build() // trung sau khi lowercase
                ))
                .build();

        AppException ex = assertThrows(AppException.class, () -> movieService.updateMovie(1L, request));
        assertEquals(MovieErrorCode.DUPLICATE_TRANSLATION_LANGUAGE, ex.getErrorCode());
        verify(movieTranslationRepository, never()).save(any());
        verify(movieTranslationRepository, never()).deleteAll(anyList());
    }

    // ── Cast reconciliation ───────────────────────────────────────────────────

    @Test
    void existingCastEntryIsUpdatedInPlaceCastIdPreserved() {
        Person director = Person.builder().personId(10L).fullName("Director X").build();
        MovieCast existingCast = MovieCast.builder()
                .castId(99L).movie(movie).person(director).roleType("DIRECTOR")
                .characterName(null).billingOrder(1)
                .build();
        when(movieCastRepository.findByMovie_MovieId(1L)).thenReturn(List.of(existingCast));
        when(personRepository.findAllById(any())).thenReturn(List.of(director));
        when(movieCastRepository.save(any(MovieCast.class))).thenAnswer(inv -> inv.getArgument(0));

        UpdateMovieRequest request = UpdateMovieRequest.builder()
                .cast(List.of(CastRequest.builder()
                        .personId(10L).roleType("director").billingOrder(2).build()))
                .build();

        movieService.updateMovie(1L, request);

        ArgumentCaptor<MovieCast> captor = ArgumentCaptor.forClass(MovieCast.class);
        verify(movieCastRepository).save(captor.capture());
        assertSame(existingCast, captor.getValue(), "Phai update tai cho, khong tao MovieCast moi");
        assertEquals(99L, existingCast.getCastId(), "castId phai giu nguyen");
        assertEquals(2, existingCast.getBillingOrder(), "billingOrder phai duoc cap nhat");
        verify(movieCastRepository, never()).deleteAll(anyList());
    }

    @Test
    void castEntryMissingFromNonEmptyRequestIsDeleted() {
        Person p1 = Person.builder().personId(10L).build();
        Person p2 = Person.builder().personId(11L).build();
        MovieCast cast1 = MovieCast.builder().castId(1L).movie(movie).person(p1).roleType("DIRECTOR").build();
        MovieCast cast2 = MovieCast.builder().castId(2L).movie(movie).person(p2).roleType("ACTOR").build();
        when(movieCastRepository.findByMovie_MovieId(1L)).thenReturn(List.of(cast1, cast2));
        when(personRepository.findAllById(any())).thenReturn(List.of(p1));
        when(movieCastRepository.save(any(MovieCast.class))).thenAnswer(inv -> inv.getArgument(0));

        // Chi gui lai person 10/DIRECTOR - cast2 (person 11/ACTOR) phai bi xoa.
        UpdateMovieRequest request = UpdateMovieRequest.builder()
                .cast(List.of(CastRequest.builder().personId(10L).roleType("DIRECTOR").build()))
                .build();

        movieService.updateMovie(1L, request);

        verify(movieCastRepository).deleteAll(List.of(cast2));
    }

    @Test
    void unknownPersonIdThrowsBeforeAnyCastDeleteOrSave() {
        MovieCast existingCast = MovieCast.builder()
                .castId(1L).movie(movie)
                .person(Person.builder().personId(10L).build())
                .roleType("DIRECTOR").build();
        when(movieCastRepository.findByMovie_MovieId(1L)).thenReturn(List.of(existingCast));
        when(personRepository.findAllById(any())).thenReturn(List.of()); // personId 999 khong ton tai

        UpdateMovieRequest request = UpdateMovieRequest.builder()
                .cast(List.of(CastRequest.builder().personId(999L).roleType("ACTOR").build()))
                .build();

        AppException ex = assertThrows(AppException.class, () -> movieService.updateMovie(1L, request));
        assertEquals(MovieErrorCode.PERSON_NOT_FOUND, ex.getErrorCode());
        // Quan trong nhat: khong duoc xoa/luu bat ky cast nao truoc khi phat hien personId sai.
        verify(movieCastRepository, never()).deleteAll(anyList());
        verify(movieCastRepository, never()).save(any());
    }

    @Test
    void duplicatePersonRoleInCastRequestThrows() {
        when(movieCastRepository.findByMovie_MovieId(1L)).thenReturn(List.of());

        UpdateMovieRequest request = UpdateMovieRequest.builder()
                .cast(List.of(
                        CastRequest.builder().personId(10L).roleType("ACTOR").build(),
                        CastRequest.builder().personId(10L).roleType("actor").build() // trung sau khi uppercase
                ))
                .build();

        AppException ex = assertThrows(AppException.class, () -> movieService.updateMovie(1L, request));
        assertEquals(MovieErrorCode.DUPLICATE_CAST_ENTRY, ex.getErrorCode());
        verify(movieCastRepository, never()).save(any());
        verify(movieCastRepository, never()).deleteAll(anyList());
        verifyNoInteractions(personRepository);
    }

    @Test
    void emptyCastListDeletesAllExisting() {
        MovieCast existingCast = MovieCast.builder()
                .castId(1L).movie(movie)
                .person(Person.builder().personId(10L).build())
                .roleType("DIRECTOR").build();
        when(movieCastRepository.findByMovie_MovieId(1L)).thenReturn(List.of(existingCast));

        UpdateMovieRequest request = UpdateMovieRequest.builder()
                .cast(List.of())
                .build();

        movieService.updateMovie(1L, request);

        verify(movieCastRepository).deleteAll(List.of(existingCast));
        verify(movieCastRepository, never()).save(any());
        verifyNoInteractions(personRepository);
    }

    // ── "Rollback" - pham vi Mockito co the chung minh duoc ──────────────────

    /**
     * Luu y quan trong ve pham vi cua test nay: Mockito khong co transaction/persistence
     * context that, nen KHONG the chung minh DB rollback thuc su nhu mot integration test
     * tren Postgres that. Test nay chi chung minh dieu kien CAN de @Transactional cua Spring
     * hoat dong dung: exception phai duoc nem thang ra ngoai updateMovie() (khong bi nuot/catch
     * o dau do giua chung), va method KHONG duoc di tiep den buoc luu/tra ve cuoi cung
     * (movieRepository.save() + movieMapper.toMovieResponse()) khi mot buoc reconcile SAU do
     * that bai - tuc la khong bao gio co "thanh cong mot phan" / "false success" o tang service.
     * Muon xac nhan DB rollback toan bo that su (bao gom ca cac dong da INSERT/UPDATE truoc do
     * trong cung transaction), can mot integration test that voi Postgres - xem MR doc issue #143.
     */
    @Test
    void translationSucceedsButCastFailsPropagatesExceptionAndNeverReachesFinalPersist() {
        // Translations hop le - se di qua duoc (goi save() that su) truoc khi toi cast.
        MovieTranslation existingVi = new MovieTranslation();
        existingVi.setId(new MovieTranslationId(1L, "vi"));
        when(movieTranslationRepository.findById_MovieId(1L)).thenReturn(List.of(existingVi));
        when(movieTranslationRepository.save(any(MovieTranslation.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // Cast that bai: personId 999 khong ton tai.
        when(movieCastRepository.findByMovie_MovieId(1L)).thenReturn(List.of());
        when(personRepository.findAllById(any())).thenReturn(List.of());

        UpdateMovieRequest request = UpdateMovieRequest.builder()
                .translations(List.of(TranslationRequest.builder()
                        .languageCode("vi").title("Ten moi").build()))
                .cast(List.of(CastRequest.builder().personId(999L).roleType("ACTOR").build()))
                .build();

        AppException ex = assertThrows(AppException.class, () -> movieService.updateMovie(1L, request));
        assertEquals(MovieErrorCode.PERSON_NOT_FOUND, ex.getErrorCode());

        // Translations DA di qua - chung minh loi xay ra o buoc SAU, khong phai ngay tu dau.
        verify(movieTranslationRepository).save(existingVi);
        // Nhung tuyet doi khong duoc toi buoc luu/tra ve cuoi cung: method phai "fail toan bo"
        // chu khong "thanh cong mot phan" - day chinh la dieu kien de @Transactional cua Spring
        // (rollback-on-unchecked-exception) phat huy dung tac dung nhu thiet ke.
        verify(movieRepository, never()).save(any(Movie.class));
        verify(movieMapper, never()).toMovieResponse(any());
    }

    // ── TMDB-FIX-03: submit-for-review blocked by a still-PENDING_REVIEW genre ──

    @Test
    void submitForReviewThrowsWhenMovieHasPendingReviewGenre() {
        Genre pending = Genre.builder().genreId(50L).genreName("New Genre").genreCode("TMDB_878")
                .status(GenreStatus.PENDING_REVIEW).build();
        movie.setStatus(MovieStatus.DRAFT);
        movie.setGenres(List.of(pending));

        AppException ex = assertThrows(AppException.class, () -> movieService.submitForReview(1L, "admin"));

        assertEquals(MovieErrorCode.GENRE_PENDING_REVIEW, ex.getErrorCode());
        verify(movieRepository, never()).save(any(Movie.class));
    }

    @Test
    void submitForReviewSucceedsWhenAllAttachedGenresAreActive() {
        Genre active = Genre.builder().genreId(9L).genreName("Sci-Fi").genreCode("sci-fi")
                .status(GenreStatus.ACTIVE).build();
        movie.setStatus(MovieStatus.DRAFT);
        movie.setGenres(List.of(active));

        movieService.submitForReview(1L, "admin");

        assertEquals(MovieStatus.PENDING_REVIEW, movie.getStatus());
    }

    // ── MOV-03: readiness gates wired into create/update/submit/approve/release ──

    @Test
    void createMoviePropagatesInvalidDateRangeAndNeverSaves() {
        CreateMovieRequest request = CreateMovieRequest.builder()
                .originalTitle("New Movie")
                .originalLanguage("en")
                .durationMinutes(100)
                .releaseDate(LocalDate.of(2026, 8, 10))
                .endDate(LocalDate.of(2026, 8, 1))
                .genreIds(List.of(1L))
                .formatIds(List.of(1))
                .build();
        Movie mapped = Movie.builder().originalTitle("New Movie")
                .releaseDate(request.getReleaseDate()).endDate(request.getEndDate()).build();
        when(movieRepository.existsByOriginalTitleIgnoreCase("New Movie")).thenReturn(false);
        when(movieMapper.toMovie(request)).thenReturn(mapped);
        doThrow(new AppException(MovieErrorCode.INVALID_MOVIE_DATE_RANGE))
                .when(movieReadinessValidator)
                .requireValidDateRange(request.getReleaseDate(), request.getEndDate());

        AppException ex = assertThrows(AppException.class, () -> movieService.createMovie(request));

        assertEquals(MovieErrorCode.INVALID_MOVIE_DATE_RANGE, ex.getErrorCode());
        verify(movieRepository, never()).save(any(Movie.class));
    }

    @Test
    void updateMoviePropagatesInvalidDateRangeAfterMergingRequestOntoEntity() {
        movie.setReleaseDate(LocalDate.of(2026, 1, 1));
        movie.setEndDate(LocalDate.of(2026, 12, 31));
        // Request only changes releaseDate (partial update) - merged state now has an inverted range.
        UpdateMovieRequest request = UpdateMovieRequest.builder()
                .releaseDate(LocalDate.of(2027, 1, 1))
                .build();
        doAnswer(inv -> {
            movie.setReleaseDate(request.getReleaseDate());
            return null;
        }).when(movieMapper).updateMovieFromRequest(request, movie);
        doThrow(new AppException(MovieErrorCode.INVALID_MOVIE_DATE_RANGE))
                .when(movieReadinessValidator)
                .requireValidDateRange(LocalDate.of(2027, 1, 1), LocalDate.of(2026, 12, 31));

        AppException ex = assertThrows(AppException.class, () -> movieService.updateMovie(1L, request));

        assertEquals(MovieErrorCode.INVALID_MOVIE_DATE_RANGE, ex.getErrorCode());
        verify(movieRepository, never()).save(any(Movie.class));
    }

    @Test
    void submitForReviewPropagatesReadinessViolationAndNeverSaves() {
        movie.setStatus(MovieStatus.DRAFT);
        movie.setGenres(List.of());
        doThrow(new MovieReadinessException(MovieErrorCode.MOVIE_NOT_READY_FOR_REVIEW, List.of()))
                .when(movieReadinessValidator).requireReadyForReview(movie);

        assertThrows(MovieReadinessException.class, () -> movieService.submitForReview(1L, "admin"));

        verify(movieRepository, never()).save(any(Movie.class));
    }

    @Test
    void approveMoviePropagatesReadinessViolationAndNeverSaves() {
        movie.setStatus(MovieStatus.PENDING_REVIEW);
        doThrow(new MovieReadinessException(MovieErrorCode.MOVIE_NOT_READY_FOR_APPROVAL, List.of()))
                .when(movieReadinessValidator).requireReadyForApproval(movie);

        assertThrows(MovieReadinessException.class, () -> movieService.approveMovie(1L, "admin"));

        verify(movieRepository, never()).save(any(Movie.class));
    }

    /** MOV-LC-04: approve is a pure content decision — it must land on APPROVED,
     *  never on an exhibition state, and it must record a status-history row. */
    @Test
    void approveMovieSucceedsWhenValidatorPasses() {
        movie.setStatus(MovieStatus.PENDING_REVIEW);

        movieService.approveMovie(1L, "admin");

        verify(movieReadinessValidator).requireReadyForApproval(movie);
        assertEquals(MovieStatus.APPROVED, movie.getStatus());
        assertEquals("admin", movie.getUpdatedBy());

        ArgumentCaptor<MovieStatusHistory> historyCaptor = ArgumentCaptor.forClass(MovieStatusHistory.class);
        verify(movieStatusHistoryRepository).save(historyCaptor.capture());
        assertEquals(MovieStatus.PENDING_REVIEW, historyCaptor.getValue().getFromStatus());
        assertEquals(MovieStatus.APPROVED, historyCaptor.getValue().getToStatus());
        assertEquals("admin", historyCaptor.getValue().getActor());
    }

    @Test
    void approveRejectsWhenNotPendingReview() {
        movie.setStatus(MovieStatus.DRAFT);

        AppException ex = assertThrows(AppException.class, () -> movieService.approveMovie(1L, "admin"));

        assertEquals(MovieErrorCode.INVALID_STATUS_TRANSITION, ex.getErrorCode());
        verify(movieRepository, never()).save(any(Movie.class));
    }

    @Test
    void requestChangesRequiresPendingReviewAndStoresNote() {
        movie.setStatus(MovieStatus.PENDING_REVIEW);

        movieService.requestChanges(1L, "Poster is missing", "admin");

        assertEquals(MovieStatus.CHANGES_REQUESTED, movie.getStatus());
        assertEquals("Poster is missing", movie.getRejectionNote());
    }

    @Test
    void startRevisionMovesChangesRequestedBackToDraft() {
        movie.setStatus(MovieStatus.CHANGES_REQUESTED);

        movieService.startRevision(1L, "employee1");

        assertEquals(MovieStatus.DRAFT, movie.getStatus());
    }

    @Test
    void startRevisionRejectsWhenNotChangesRequested() {
        movie.setStatus(MovieStatus.DRAFT);

        AppException ex = assertThrows(AppException.class, () -> movieService.startRevision(1L, "employee1"));

        assertEquals(MovieErrorCode.INVALID_STATUS_TRANSITION, ex.getErrorCode());
    }

    @Test
    void archiveRequiresApprovedAndNoActiveAvailability() {
        movie.setStatus(MovieStatus.APPROVED);
        when(movieAvailabilityRepository.existsByMovie_MovieIdAndStatusIn(1L,
                List.of(AvailabilityStatus.PLANNED, AvailabilityStatus.OPEN))).thenReturn(false);

        movieService.archiveMovie(1L, "admin");

        assertEquals(MovieStatus.ARCHIVED, movie.getStatus());
    }

    @Test
    void archiveBlockedWhileAvailabilityIsPlannedOrOpen() {
        movie.setStatus(MovieStatus.APPROVED);
        when(movieAvailabilityRepository.existsByMovie_MovieIdAndStatusIn(1L,
                List.of(AvailabilityStatus.PLANNED, AvailabilityStatus.OPEN))).thenReturn(true);

        AppException ex = assertThrows(AppException.class, () -> movieService.archiveMovie(1L, "admin"));

        assertEquals(MovieErrorCode.MOVIE_HAS_ACTIVE_AVAILABILITY, ex.getErrorCode());
        verify(movieRepository, never()).save(any(Movie.class));
    }

    @Test
    void archiveRejectsWhenNotApproved() {
        movie.setStatus(MovieStatus.DRAFT);

        AppException ex = assertThrows(AppException.class, () -> movieService.archiveMovie(1L, "admin"));

        assertEquals(MovieErrorCode.INVALID_STATUS_TRANSITION, ex.getErrorCode());
    }

    // ── updateMovie: only DRAFT is directly editable ────────────────────────

    @Test
    void updateMovieRejectsWhenNotDraft() {
        movie.setStatus(MovieStatus.PENDING_REVIEW);
        UpdateMovieRequest request = UpdateMovieRequest.builder().originalTitle("New title").build();

        AppException ex = assertThrows(AppException.class, () -> movieService.updateMovie(1L, request));

        assertEquals(MovieErrorCode.MOVIE_NOT_EDITABLE, ex.getErrorCode());
        verify(movieRepository, never()).save(any(Movie.class));
    }
}
