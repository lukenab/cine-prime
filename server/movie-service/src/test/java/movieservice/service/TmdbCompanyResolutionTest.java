package movieservice.service;

import movieservice.dto.request.TmdbImportRequest;
import movieservice.dto.tmdb.TmdbCreditsResponse;
import movieservice.dto.tmdb.TmdbMovieDetail;
import movieservice.dto.tmdb.TmdbReleaseDatesResponse;
import movieservice.dto.tmdb.TmdbTranslationsResponse;
import movieservice.entity.Genre;
import movieservice.entity.Movie;
import movieservice.entity.Person;
import movieservice.entity.ProductionCompany;
import movieservice.enums.GenreStatus;
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
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Issue #151: Movie.company (single ManyToOne) -> Movie.companies (ManyToMany), with
 * ProductionCompany matched primarily by the stable tmdbCompanyId rather than an
 * exact/case-sensitive name. Exercised black-box through the public importMovie() - same
 * approach as TmdbServiceTest for the rest of the import pipeline.
 */
@ExtendWith(MockitoExtension.class)
class TmdbCompanyResolutionTest {

    @Mock MovieRepository movieRepository;
    @Mock MovieTranslationRepository movieTranslationRepository;
    @Mock MovieCastRepository movieCastRepository;
    @Mock PersonRepository personRepository;
    @Mock ProductionCompanyRepository productionCompanyRepository;
    @Mock GenreRepository genreRepository;
    @Mock AgeRatingRepository ageRatingRepository;
    @Mock RestTemplate restTemplate;

    TmdbService tmdbService;

    private static final int TMDB_ID = 693134;

    @BeforeEach
    void setUp() {
        tmdbService = new TmdbService(
                movieRepository, movieTranslationRepository, movieCastRepository, personRepository,
                productionCompanyRepository, genreRepository, ageRatingRepository, "dummy-api-key", 10);
        ReflectionTestUtils.setField(tmdbService, "restTemplate", restTemplate);

        when(movieRepository.existsByTmdbId(TMDB_ID)).thenReturn(false);
        when(movieRepository.existsByImdbId("tt15239678")).thenReturn(false);
        when(genreRepository.findByTmdbGenreId(878)).thenReturn(Optional.of(
                Genre.builder().genreId(9L).genreName("Sci-Fi").genreCode("sci-fi")
                        .tmdbGenreId(878).status(GenreStatus.ACTIVE).build()));
        lenient().when(personRepository.findByTmdbId(anyInt())).thenReturn(Optional.empty());
        lenient().when(personRepository.save(any(Person.class))).thenAnswer(inv -> inv.getArgument(0));
        when(movieRepository.save(any(Movie.class))).thenAnswer(inv -> {
            Movie m = inv.getArgument(0);
            m.setMovieId(1L);
            return m;
        });
    }

    private TmdbMovieDetail.TmdbCompany company(int tmdbId, String name, String country) {
        TmdbMovieDetail.TmdbCompany c = new TmdbMovieDetail.TmdbCompany();
        c.setId(tmdbId);
        c.setName(name);
        c.setOriginCountry(country);
        return c;
    }

    private TmdbMovieDetail detailWithCompanies(TmdbMovieDetail.TmdbCompany... companies) {
        TmdbMovieDetail detail = new TmdbMovieDetail();
        detail.setId(TMDB_ID);
        detail.setOriginalTitle("Dune: Part Two");
        detail.setOriginalLanguage("en");
        detail.setRuntime(166);
        detail.setReleaseDate("2024-02-27");
        detail.setImdbId("tt15239678");
        detail.setOverview("Paul Atreides unites with Chani...");
        detail.setProductionCountries(List.of());
        detail.setProductionCompanies(List.of(companies));

        TmdbMovieDetail.TmdbGenre genre = new TmdbMovieDetail.TmdbGenre();
        genre.setId(878);
        genre.setName("Science Fiction");
        detail.setGenres(List.of(genre));
        return detail;
    }

    private void stubHttp(TmdbMovieDetail detail) {
        when(restTemplate.getForObject(any(URI.class), eq(TmdbMovieDetail.class))).thenReturn(detail);
        when(restTemplate.getForObject(any(URI.class), eq(TmdbCreditsResponse.class)))
                .thenReturn(new TmdbCreditsResponse());
        when(restTemplate.getForObject(any(URI.class), eq(TmdbTranslationsResponse.class)))
                .thenReturn(new TmdbTranslationsResponse());
        when(restTemplate.getForObject(any(URI.class), eq(TmdbReleaseDatesResponse.class)))
                .thenReturn(new TmdbReleaseDatesResponse());
    }

    private TmdbImportRequest importRequest() {
        TmdbImportRequest request = new TmdbImportRequest();
        ReflectionTestUtils.setField(request, "tmdbId", TMDB_ID);
        return request;
    }

    @Test
    void importMovieLinksAllTmdbCompaniesNotJustTheFirst() {
        stubHttp(detailWithCompanies(
                company(923, "Legendary Pictures", "US"),
                company(174, "Warner Bros. Pictures", "US")));
        when(productionCompanyRepository.findByTmdbCompanyId(923)).thenReturn(Optional.empty());
        when(productionCompanyRepository.findByTmdbCompanyId(174)).thenReturn(Optional.empty());
        when(productionCompanyRepository.save(any(ProductionCompany.class))).thenAnswer(inv -> inv.getArgument(0));

        tmdbService.importMovie(importRequest());

        ArgumentCaptor<Movie> captor = ArgumentCaptor.forClass(Movie.class);
        verify(movieRepository).save(captor.capture());
        assertEquals(2, captor.getValue().getCompanies().size(),
                "All TMDB-listed companies must be linked, not only the first one (issue #151)");
        assertEquals("Legendary Pictures", captor.getValue().getCompanies().get(0).getName());
        assertEquals("Warner Bros. Pictures", captor.getValue().getCompanies().get(1).getName());
    }

    @Test
    void importMovieMatchesExistingCompanyByTmdbIdEvenWhenNameDiffers() {
        stubHttp(detailWithCompanies(company(923, "Legendary Pictures", "US")));

        // Local row was renamed/re-cased after initial import - the old exact-name lookup
        // would have missed it and created a duplicate; tmdbCompanyId must still find it.
        ProductionCompany existing = ProductionCompany.builder()
                .companyId(55L).name("Legendary").tmdbCompanyId(923).build();
        when(productionCompanyRepository.findByTmdbCompanyId(923)).thenReturn(Optional.of(existing));
        when(productionCompanyRepository.save(any(ProductionCompany.class))).thenAnswer(inv -> inv.getArgument(0));

        tmdbService.importMovie(importRequest());

        ArgumentCaptor<Movie> captor = ArgumentCaptor.forClass(Movie.class);
        verify(movieRepository).save(captor.capture());
        assertEquals(55L, captor.getValue().getCompanies().get(0).getCompanyId());
        verify(productionCompanyRepository, never()).findByName(any());
    }

    @Test
    void importMovieEnrichesExistingCompanyWithoutErasingLocalFields() {
        stubHttp(detailWithCompanies(company(923, "Legendary Pictures", null)));

        // Locally curated logoUrl must survive even though this TMDB response has no logo data
        // for this company (TmdbCompanyDraft only ever carries what /credits itself returns).
        ProductionCompany existing = ProductionCompany.builder()
                .companyId(55L).name("Legendary Pictures").tmdbCompanyId(923)
                .country("United States").logoUrl("https://cdn.local/legendary-logo.png").build();
        when(productionCompanyRepository.findByTmdbCompanyId(923)).thenReturn(Optional.of(existing));
        when(productionCompanyRepository.save(any(ProductionCompany.class))).thenAnswer(inv -> inv.getArgument(0));

        tmdbService.importMovie(importRequest());

        ArgumentCaptor<Movie> captor = ArgumentCaptor.forClass(Movie.class);
        verify(movieRepository).save(captor.capture());
        ProductionCompany linked = captor.getValue().getCompanies().get(0);
        assertEquals("https://cdn.local/legendary-logo.png", linked.getLogoUrl(),
                "A field TMDB didn't provide this time must not erase the existing local value");
        assertEquals("United States", linked.getCountry());
    }

    @Test
    void importMovieReusesCompanyOnConcurrentUniqueConstraintViolation() {
        stubHttp(detailWithCompanies(company(923, "Legendary Pictures", "US")));
        when(productionCompanyRepository.findByTmdbCompanyId(923))
                .thenReturn(Optional.empty()) // first check: not there yet
                .thenReturn(Optional.of(ProductionCompany.builder() // re-fetch after the race: now it is
                        .companyId(77L).name("Legendary Pictures").tmdbCompanyId(923).build()));
        when(productionCompanyRepository.save(any(ProductionCompany.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate tmdb_company_id"));

        tmdbService.importMovie(importRequest());

        ArgumentCaptor<Movie> captor = ArgumentCaptor.forClass(Movie.class);
        verify(movieRepository).save(captor.capture());
        assertEquals(77L, captor.getValue().getCompanies().get(0).getCompanyId(),
                "A concurrent duplicate-key failure must fall back to the row the other transaction created, not propagate");
    }

    @Test
    void importMovieDedupesTwoTmdbCompanyDraftsThatResolveToTheSameLocalRow() {
        // Defensive: if TMDB's own payload somehow lists the same company twice (or two drafts
        // resolve to the same existing row), the movie must not end up linked to it twice.
        stubHttp(detailWithCompanies(
                company(923, "Legendary Pictures", "US"),
                company(923, "Legendary Pictures", "US")));
        ProductionCompany existing = ProductionCompany.builder()
                .companyId(55L).name("Legendary Pictures").tmdbCompanyId(923).build();
        when(productionCompanyRepository.findByTmdbCompanyId(923)).thenReturn(Optional.of(existing));
        when(productionCompanyRepository.save(any(ProductionCompany.class))).thenAnswer(inv -> inv.getArgument(0));

        tmdbService.importMovie(importRequest());

        ArgumentCaptor<Movie> captor = ArgumentCaptor.forClass(Movie.class);
        verify(movieRepository).save(captor.capture());
        assertEquals(1, captor.getValue().getCompanies().size());
    }
}
