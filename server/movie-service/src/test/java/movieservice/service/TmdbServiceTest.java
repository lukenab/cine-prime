package movieservice.service;

import movieservice.dto.response.TmdbCastPreview;
import movieservice.dto.response.TmdbCompanyPreview;
import movieservice.dto.response.TmdbMovieDetailsResponse;
import movieservice.dto.tmdb.TmdbCreditsResponse;
import movieservice.dto.tmdb.TmdbMovieDetail;
import movieservice.dto.tmdb.TmdbReleaseDatesResponse;
import movieservice.dto.tmdb.TmdbTranslationsResponse;
import movieservice.entity.Person;
import movieservice.entity.ProductionCompany;
import movieservice.repository.AgeRatingRepository;
import movieservice.repository.GenreRepository;
import movieservice.repository.MovieCastRepository;
import movieservice.repository.MovieRepository;
import movieservice.repository.MovieTranslationRepository;
import movieservice.repository.PersonRepository;
import movieservice.repository.ProductionCompanyRepository;
import movieservice.repository.ScreeningFormatRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Issue #188 - "Make TMDB details preview read-only".
 * Truoc fix: TmdbService.getDetails() la @Transactional va goi upsertCompany()/upsertPerson(),
 * nghia la chi can admin mo modal preview la production_company/person da co row moi trong DB.
 * Cac test duoi day chung minh dieu do KHONG con xay ra nua: goi getDetails() khong duoc phep
 * goi save()/update()/delete() len BAT KY repository nao, ke ca khi company/person do da ton tai
 * san trong DB (truong hop "tim thay" van phai la mot truy van read-only, khong duoc "tien the
 * ghi lai" gia tri gi ca).
 *
 * TmdbService tu tao rieng mot RestTemplate trong constructor (khong inject qua Spring), nen
 * test nay dung ReflectionTestUtils de thay field private "restTemplate" bang 1 Mockito mock
 * sau khi khoi tao that - day la cach duy nhat de stub HTTP call ma khong can that su goi TMDB.
 */
@ExtendWith(MockitoExtension.class)
class TmdbServiceTest {

    @Mock MovieRepository movieRepository;
    @Mock MovieTranslationRepository movieTranslationRepository;
    @Mock MovieCastRepository movieCastRepository;
    @Mock PersonRepository personRepository;
    @Mock ProductionCompanyRepository productionCompanyRepository;
    @Mock ScreeningFormatRepository screeningFormatRepository;
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
                screeningFormatRepository,
                genreRepository,
                ageRatingRepository,
                "dummy-api-key");
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

    /** Stub 4 HTTP calls ben trong getDetails(): movie detail, credits, translations, release dates. */
    private void stubTmdbHttpCalls(TmdbMovieDetail detail, TmdbCreditsResponse credits) {
        when(restTemplate.getForObject(any(URI.class), eq(TmdbMovieDetail.class))).thenReturn(detail);
        when(restTemplate.getForObject(any(URI.class), eq(TmdbCreditsResponse.class))).thenReturn(credits);
        when(restTemplate.getForObject(any(URI.class), eq(TmdbTranslationsResponse.class)))
                .thenReturn(new TmdbTranslationsResponse());
        when(restTemplate.getForObject(any(URI.class), eq(TmdbReleaseDatesResponse.class)))
                .thenReturn(new TmdbReleaseDatesResponse());
    }

    @Test
    void getDetailsNeverWritesToAnyRepositoryWhenCompanyAndPersonAreNew() {
        TmdbMovieDetail detail = detailWithOneCompanyAndGenre();
        TmdbCreditsResponse credits = creditsWithOneDirectorAndOneActor();
        stubTmdbHttpCalls(detail, credits);

        // Company/person chua tung duoc import - phai tra localId = null, KHONG duoc tao moi.
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
        verifyNoInteractions(movieRepository, movieTranslationRepository, movieCastRepository,
                screeningFormatRepository);
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
}
