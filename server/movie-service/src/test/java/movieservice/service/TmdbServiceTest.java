package movieservice.service;

import movie.theater.common.exception.AppException;
import movieservice.dto.request.TmdbImportRequest;
import movieservice.dto.response.TmdbCastPreview;
import movieservice.dto.response.TmdbCompanyPreview;
import movieservice.dto.response.TmdbGenrePreview;
import movieservice.dto.response.TmdbImportResponse;
import movieservice.dto.response.TmdbMovieDetailsResponse;
import movieservice.dto.tmdb.TmdbCreditsResponse;
import movieservice.dto.tmdb.TmdbMovieDetail;
import movieservice.dto.tmdb.TmdbReleaseDatesResponse;
import movieservice.dto.tmdb.TmdbTranslationsResponse;
import movieservice.entity.Genre;
import movieservice.entity.Movie;
import movieservice.entity.Person;
import movieservice.entity.ProductionCompany;
import movieservice.enums.GenreStatus;
import movieservice.enums.MovieStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.AgeRatingRepository;
import movieservice.repository.GenreRepository;
import movieservice.repository.MovieCastRepository;
import movieservice.repository.MovieRepository;
import movieservice.repository.MovieTranslationRepository;
import movieservice.repository.PersonRepository;
import movieservice.repository.ProductionCompanyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * TMDB-FIX-02 (unify preview/import pipeline) and TMDB-FIX-03 (stop silently dropping unmapped
 * genres). Preview-read-only coverage is inherited from issue #188.
 */
@ExtendWith(MockitoExtension.class)
class TmdbServiceTest {

    @Mock MovieRepository movieRepository;
    @Mock MovieTranslationRepository movieTranslationRepository;
    @Mock MovieCastRepository movieCastRepository;
    @Mock PersonRepository personRepository;
    @Mock ProductionCompanyRepository productionCompanyRepository;
    @Mock GenreRepository genreRepository;
    @Mock AgeRatingRepository ageRatingRepository;
    @Mock RestTemplate restTemplate;

    TmdbService tmdbService;

    @BeforeEach
    void setUp() {
        tmdbService = new TmdbService(
                movieRepository,
                movieTranslationRepository,
                movieCastRepository,
                personRepository,
                productionCompanyRepository,
                genreRepository,
                ageRatingRepository,
                "dummy-api-key",
                10);
        // TmdbService tu new RestTemplate() trong constructor - thay bang mock qua reflection
        // de co the stub cac cuoc goi HTTP ben trong fetchMovieDetail()/fetchCredits()/...
        ReflectionTestUtils.setField(tmdbService, "restTemplate", restTemplate);
    }

    private TmdbMovieDetail detailWithOneCompanyAndGenre() {
        TmdbMovieDetail detail = new TmdbMovieDetail();
        detail.setId(693134);
        detail.setOriginalTitle("Dune: Part Two");
        detail.setOriginalLanguage("en");
        detail.setRuntime(166);
        detail.setReleaseDate("2024-02-27");
        detail.setImdbId("tt15239678");
        detail.setOverview("Paul Atreides unites with Chani...");
        detail.setPosterPath("/poster.jpg");
        detail.setProductionCountries(List.of());

        TmdbMovieDetail.TmdbCompany company = new TmdbMovieDetail.TmdbCompany();
        company.setId(923);
        company.setName("Legendary Pictures");
        company.setOriginCountry("US");
        detail.setProductionCompanies(List.of(company));

        TmdbMovieDetail.TmdbGenre genre = new TmdbMovieDetail.TmdbGenre();
        genre.setId(878);
        genre.setName("Science Fiction");
        detail.setGenres(List.of(genre));

        return detail;
    }

    private TmdbCreditsResponse creditsWithOneDirectorAndOneActor() {
        TmdbCreditsResponse credits = new TmdbCreditsResponse();

        TmdbCreditsResponse.CrewMember director = new TmdbCreditsResponse.CrewMember();
        director.setId(100);
        director.setName("Denis Villeneuve");
        director.setJob("Director");
        credits.setCrew(List.of(director));

        TmdbCreditsResponse.CastMember actor = new TmdbCreditsResponse.CastMember();
        actor.setId(200);
        actor.setName("Timothee Chalamet");
        actor.setCharacter("Paul Atreides");
        actor.setOrder(0);
        credits.setCast(List.of(actor));

        return credits;
    }

    /** Stub 4 HTTP calls ben trong fetchAll(): movie detail, credits, translations, release dates. */
    private void stubTmdbHttpCalls(TmdbMovieDetail detail, TmdbCreditsResponse credits) {
        when(restTemplate.getForObject(any(URI.class), eq(TmdbMovieDetail.class))).thenReturn(detail);
        when(restTemplate.getForObject(any(URI.class), eq(TmdbCreditsResponse.class))).thenReturn(credits);
        when(restTemplate.getForObject(any(URI.class), eq(TmdbTranslationsResponse.class)))
                .thenReturn(new TmdbTranslationsResponse());
        when(restTemplate.getForObject(any(URI.class), eq(TmdbReleaseDatesResponse.class)))
                .thenReturn(new TmdbReleaseDatesResponse());
    }

    private TmdbImportRequest importRequest(Integer tmdbId) {
        TmdbImportRequest request = new TmdbImportRequest();
        ReflectionTestUtils.setField(request, "tmdbId", tmdbId);
        return request;
    }

    private Genre activeGenre(long id, Integer tmdbGenreId, String name) {
        return Genre.builder().genreId(id).genreName(name).genreCode("code-" + id)
                .tmdbGenreId(tmdbGenreId).status(GenreStatus.ACTIVE).build();
    }

    /** Wires the happy-path company/person upserts so importMovie() can reach movieRepository.save(). */
    private void stubCompanyAndPersonUpsertsAsNew() {
        when(productionCompanyRepository.findByName("Legendary Pictures")).thenReturn(Optional.empty());
        when(productionCompanyRepository.save(any(ProductionCompany.class))).thenAnswer(inv -> inv.getArgument(0));
        // lenient(): tests that fail before reaching saveCast() (e.g. movieRepository.save() race)
        // never touch these - without lenient() Mockito's strict stubbing would flag them oan.
        lenient().when(personRepository.findByTmdbId(anyInt())).thenReturn(Optional.empty());
        lenient().when(personRepository.save(any(Person.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private void stubMovieSaveAssignsId(long movieId) {
        when(movieRepository.save(any(Movie.class))).thenAnswer(inv -> {
            Movie m = inv.getArgument(0);
            m.setMovieId(movieId);
            return m;
        });
    }

    // ── Preview read-only (issue #188) ────────────────────────

    @Test
    void getDetailsNeverWritesToAnyRepositoryWhenCompanyAndPersonAreNew() {
        TmdbMovieDetail detail = detailWithOneCompanyAndGenre();
        TmdbCreditsResponse credits = creditsWithOneDirectorAndOneActor();
        stubTmdbHttpCalls(detail, credits);

        when(productionCompanyRepository.findByName("Legendary Pictures")).thenReturn(Optional.empty());
        when(personRepository.findByTmdbId(100)).thenReturn(Optional.empty());
        when(personRepository.findByTmdbId(200)).thenReturn(Optional.empty());

        TmdbMovieDetailsResponse response = tmdbService.getDetails(693134);

        assertEquals(1, response.getCompanies().size());
        TmdbCompanyPreview companyPreview = response.getCompanies().get(0);
        assertEquals(923, companyPreview.getTmdbId());
        assertEquals("Legendary Pictures", companyPreview.getName());
        assertNull(companyPreview.getLocalCompanyId(),
                "Company chua tung import - localCompanyId phai null, KHONG duoc tu tao ProductionCompany moi");

        assertEquals(2, response.getCast().size());
        TmdbCastPreview directorPreview = response.getCast().get(0);
        assertEquals(100, directorPreview.getTmdbId());
        assertEquals("DIRECTOR", directorPreview.getRoleType());
        assertNull(directorPreview.getLocalPersonId(),
                "Person chua tung import - localPersonId phai null, KHONG duoc tu tao Person moi");
        TmdbCastPreview actorPreview = response.getCast().get(1);
        assertEquals(200, actorPreview.getTmdbId());
        assertEquals("ACTOR", actorPreview.getRoleType());
        assertEquals("Paul Atreides", actorPreview.getCharacterName());
        assertNull(actorPreview.getLocalPersonId());

        // Cot loi cua issue #188: preview khong duoc phep ghi bat ky repository nao.
        verify(productionCompanyRepository, never()).save(any());
        verify(personRepository, never()).save(any());
        verify(genreRepository, never()).save(any());
        verifyNoInteractions(movieRepository, movieTranslationRepository, movieCastRepository);
    }

    @Test
    void getDetailsReportsExistingLocalIdsWithoutWritingWhenAlreadyImported() {
        TmdbMovieDetail detail = detailWithOneCompanyAndGenre();
        TmdbCreditsResponse credits = creditsWithOneDirectorAndOneActor();
        stubTmdbHttpCalls(detail, credits);

        ProductionCompany existingCompany = ProductionCompany.builder()
                .companyId(55L).name("Legendary Pictures").build();
        when(productionCompanyRepository.findByName("Legendary Pictures"))
                .thenReturn(Optional.of(existingCompany));

        Person existingDirector = Person.builder()
                .personId(11L).tmdbId(100).fullName("Denis Villeneuve").build();
        when(personRepository.findByTmdbId(100)).thenReturn(Optional.of(existingDirector));
        when(personRepository.findByTmdbId(200)).thenReturn(Optional.empty());

        TmdbMovieDetailsResponse response = tmdbService.getDetails(693134);

        // Da tung import truoc do - preview duoc phep BAO CAO lai local ID nay, nhung tuyet doi
        // khong duoc goi save()/update() gi len entity da tim thay ca.
        assertEquals(55L, response.getCompanies().get(0).getLocalCompanyId());
        assertEquals(11L, response.getCast().get(0).getLocalPersonId());
        assertNull(response.getCast().get(1).getLocalPersonId());

        verify(productionCompanyRepository, never()).save(any());
        verify(personRepository, never()).save(any());
        verifyNoInteractions(movieRepository, movieTranslationRepository, movieCastRepository);
    }

    // ── TMDB-FIX-03: preview never drops an unmapped genre ────

    @Test
    void getDetailsReportsUnmappedGenreInsteadOfDroppingIt() {
        TmdbMovieDetail detail = detailWithOneCompanyAndGenre();
        TmdbCreditsResponse credits = creditsWithOneDirectorAndOneActor();
        stubTmdbHttpCalls(detail, credits);
        when(productionCompanyRepository.findByName("Legendary Pictures")).thenReturn(Optional.empty());
        when(personRepository.findByTmdbId(anyInt())).thenReturn(Optional.empty());
        // No local genre matches tmdbGenreId=878 by id, code, or name -> UNMAPPED.

        TmdbMovieDetailsResponse response = tmdbService.getDetails(693134);

        assertEquals(1, response.getGenres().size());
        TmdbGenrePreview genrePreview = response.getGenres().get(0);
        assertEquals(878, genrePreview.getTmdbGenreId());
        assertEquals("Science Fiction", genrePreview.getName());
        assertNull(genrePreview.getLocalGenreId());
        assertEquals("UNMAPPED", genrePreview.getMappingStatus());
        assertTrue(response.getWarnings().contains("GENRE_UNMAPPED:878"));
        verify(genreRepository, never()).save(any());
    }

    // ── TMDB-FIX-02: import never silently defaults runtime ───

    @Test
    void importMovieBlocksWhenRuntimeMissingWithoutOverride() {
        TmdbMovieDetail detail = detailWithOneCompanyAndGenre();
        detail.setRuntime(null);
        stubTmdbHttpCalls(detail, creditsWithOneDirectorAndOneActor());
        when(movieRepository.existsByTmdbId(693134)).thenReturn(false);
        when(movieRepository.existsByImdbId("tt15239678")).thenReturn(false);

        AppException ex = assertThrows(AppException.class, () -> tmdbService.importMovie(importRequest(693134)));

        assertEquals(MovieErrorCode.MISSING_RUNTIME, ex.getErrorCode());
        verify(movieRepository, never()).save(any());
    }

    @Test
    void importMovieSucceedsWithConfirmedRuntimeMinutesOverride() {
        TmdbMovieDetail detail = detailWithOneCompanyAndGenre();
        detail.setRuntime(null);
        stubTmdbHttpCalls(detail, creditsWithOneDirectorAndOneActor());
        when(movieRepository.existsByTmdbId(693134)).thenReturn(false);
        when(movieRepository.existsByImdbId("tt15239678")).thenReturn(false);
        when(genreRepository.findByTmdbGenreId(878)).thenReturn(Optional.of(activeGenre(9L, 878, "Sci-Fi")));
        stubCompanyAndPersonUpsertsAsNew();
        stubMovieSaveAssignsId(1L);

        TmdbImportRequest request = importRequest(693134);
        ReflectionTestUtils.setField(request, "confirmedRuntimeMinutes", 140);

        tmdbService.importMovie(request);

        ArgumentCaptor<Movie> captor = ArgumentCaptor.forClass(Movie.class);
        verify(movieRepository).save(captor.capture());
        assertEquals(140, captor.getValue().getDurationMinutes());
    }

    // ── TMDB-FIX-02: import never silently attaches a screening format, always DRAFT ──

    @Test
    void importMovieCreatesDraftWithNoFormatsAndWarnsScreeningFormatNotSet() {
        TmdbMovieDetail detail = detailWithOneCompanyAndGenre();
        stubTmdbHttpCalls(detail, creditsWithOneDirectorAndOneActor());
        when(movieRepository.existsByTmdbId(693134)).thenReturn(false);
        when(movieRepository.existsByImdbId("tt15239678")).thenReturn(false);
        when(genreRepository.findByTmdbGenreId(878)).thenReturn(Optional.of(activeGenre(9L, 878, "Sci-Fi")));
        stubCompanyAndPersonUpsertsAsNew();
        stubMovieSaveAssignsId(1L);

        TmdbImportResponse response = tmdbService.importMovie(importRequest(693134));

        assertEquals("DRAFT", response.getStatus());
        assertEquals(1L, response.getMovieId());
        assertTrue(response.getWarnings().contains("SCREENING_FORMAT_NOT_SET"));

        ArgumentCaptor<Movie> captor = ArgumentCaptor.forClass(Movie.class);
        verify(movieRepository).save(captor.capture());
        assertTrue(captor.getValue().getFormats().isEmpty());
        assertEquals(MovieStatus.DRAFT, captor.getValue().getStatus());
    }

    // ── TMDB-FIX-03: import never silently drops or auto-activates an unmapped genre ──

    @Test
    void importMovieBlocksOnUnresolvedGenreMapping() {
        TmdbMovieDetail detail = detailWithOneCompanyAndGenre();
        stubTmdbHttpCalls(detail, creditsWithOneDirectorAndOneActor());
        when(movieRepository.existsByTmdbId(693134)).thenReturn(false);
        when(movieRepository.existsByImdbId("tt15239678")).thenReturn(false);
        // tmdbGenreId=878 matches nothing locally and the request doesn't map/create/ignore it.

        AppException ex = assertThrows(AppException.class, () -> tmdbService.importMovie(importRequest(693134)));

        assertEquals(MovieErrorCode.UNRESOLVED_GENRE_MAPPING, ex.getErrorCode());
        verify(productionCompanyRepository, never()).save(any());
        verify(movieRepository, never()).save(any());
    }

    @Test
    void importMovieResolvesUnmappedGenreViaSelectedGenreMappings() {
        TmdbMovieDetail detail = detailWithOneCompanyAndGenre();
        stubTmdbHttpCalls(detail, creditsWithOneDirectorAndOneActor());
        when(movieRepository.existsByTmdbId(693134)).thenReturn(false);
        when(movieRepository.existsByImdbId("tt15239678")).thenReturn(false);
        when(genreRepository.findById(9L)).thenReturn(Optional.of(activeGenre(9L, null, "Khoa Học Viễn Tưởng")));
        stubCompanyAndPersonUpsertsAsNew();
        stubMovieSaveAssignsId(1L);

        TmdbImportRequest request = importRequest(693134);
        ReflectionTestUtils.setField(request, "selectedGenreMappings", Map.of(878, 9L));

        tmdbService.importMovie(request);

        ArgumentCaptor<Movie> captor = ArgumentCaptor.forClass(Movie.class);
        verify(movieRepository).save(captor.capture());
        assertEquals(1, captor.getValue().getGenres().size());
        assertEquals(9L, captor.getValue().getGenres().get(0).getGenreId());
    }

    @Test
    void importMovieCreatesPendingReviewGenreViaCreatePendingGenres() {
        TmdbMovieDetail detail = detailWithOneCompanyAndGenre();
        stubTmdbHttpCalls(detail, creditsWithOneDirectorAndOneActor());
        when(movieRepository.existsByTmdbId(693134)).thenReturn(false);
        when(movieRepository.existsByImdbId("tt15239678")).thenReturn(false);
        when(genreRepository.findByTmdbGenreId(878)).thenReturn(Optional.empty());
        when(genreRepository.save(any(Genre.class))).thenAnswer(inv -> {
            Genre g = inv.getArgument(0);
            g.setGenreId(50L);
            return g;
        });
        stubCompanyAndPersonUpsertsAsNew();
        stubMovieSaveAssignsId(1L);

        TmdbImportRequest request = importRequest(693134);
        ReflectionTestUtils.setField(request, "createPendingGenres", List.of(878));

        tmdbService.importMovie(request);

        ArgumentCaptor<Genre> genreCaptor = ArgumentCaptor.forClass(Genre.class);
        verify(genreRepository).save(genreCaptor.capture());
        Genre created = genreCaptor.getValue();
        assertEquals(GenreStatus.PENDING_REVIEW, created.getStatus());
        assertEquals(878, created.getTmdbGenreId());
        assertEquals("TMDB_878", created.getGenreCode());

        ArgumentCaptor<Movie> movieCaptor = ArgumentCaptor.forClass(Movie.class);
        verify(movieRepository).save(movieCaptor.capture());
        assertEquals(1, movieCaptor.getValue().getGenres().size());
        assertEquals(GenreStatus.PENDING_REVIEW, movieCaptor.getValue().getGenres().get(0).getStatus());
    }

    @Test
    void importMovieIgnoresGenreWithReasonInsteadOfBlocking() {
        TmdbMovieDetail detail = detailWithOneCompanyAndGenre();
        stubTmdbHttpCalls(detail, creditsWithOneDirectorAndOneActor());
        when(movieRepository.existsByTmdbId(693134)).thenReturn(false);
        when(movieRepository.existsByImdbId("tt15239678")).thenReturn(false);
        stubCompanyAndPersonUpsertsAsNew();
        stubMovieSaveAssignsId(1L);

        TmdbImportRequest request = importRequest(693134);
        ReflectionTestUtils.setField(request, "ignoredGenres", Map.of(878, "not relevant locally"));

        TmdbImportResponse response = tmdbService.importMovie(request);

        assertTrue(response.getWarnings().stream().anyMatch(w -> w.startsWith("GENRE_IGNORED:878:")));
        ArgumentCaptor<Movie> captor = ArgumentCaptor.forClass(Movie.class);
        verify(movieRepository).save(captor.capture());
        assertTrue(captor.getValue().getGenres().isEmpty());
        verify(genreRepository, never()).save(any());
    }

    // ── TMDB-FIX-02: duplicate detection by tmdbId AND imdbId, race-safe ──

    @Test
    void importMovieThrowsConflictWhenTmdbIdAlreadyImported() {
        when(movieRepository.existsByTmdbId(693134)).thenReturn(true);

        AppException ex = assertThrows(AppException.class, () -> tmdbService.importMovie(importRequest(693134)));

        assertEquals(MovieErrorCode.TMDB_MOVIE_ALREADY_EXISTS, ex.getErrorCode());
        verifyNoInteractions(restTemplate);
    }

    @Test
    void importMovieThrowsConflictWhenImdbIdAlreadyImported() {
        TmdbMovieDetail detail = detailWithOneCompanyAndGenre();
        stubTmdbHttpCalls(detail, creditsWithOneDirectorAndOneActor());
        when(movieRepository.existsByTmdbId(693134)).thenReturn(false);
        when(movieRepository.existsByImdbId("tt15239678")).thenReturn(true);

        AppException ex = assertThrows(AppException.class, () -> tmdbService.importMovie(importRequest(693134)));

        assertEquals(MovieErrorCode.TMDB_MOVIE_ALREADY_EXISTS, ex.getErrorCode());
        verify(movieRepository, never()).save(any());
    }

    @Test
    void importMovieMapsConcurrentUniqueConstraintViolationToConflict() {
        TmdbMovieDetail detail = detailWithOneCompanyAndGenre();
        stubTmdbHttpCalls(detail, creditsWithOneDirectorAndOneActor());
        when(movieRepository.existsByTmdbId(693134)).thenReturn(false);
        when(movieRepository.existsByImdbId("tt15239678")).thenReturn(false);
        when(genreRepository.findByTmdbGenreId(878)).thenReturn(Optional.of(activeGenre(9L, 878, "Sci-Fi")));
        stubCompanyAndPersonUpsertsAsNew();
        when(movieRepository.save(any(Movie.class))).thenThrow(new DataIntegrityViolationException("dup tmdb_id"));

        AppException ex = assertThrows(AppException.class, () -> tmdbService.importMovie(importRequest(693134)));

        assertEquals(MovieErrorCode.TMDB_MOVIE_ALREADY_EXISTS, ex.getErrorCode());
    }
}
