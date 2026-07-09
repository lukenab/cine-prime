package movieservice.service;

import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import movieservice.dto.response.TmdbImportResponse;
import movieservice.dto.response.TmdbSearchResultItem;
import movieservice.dto.tmdb.TmdbCreditsResponse;
import movieservice.dto.tmdb.TmdbMovieDetail;
import movieservice.dto.tmdb.TmdbSearchResponse;
import movieservice.dto.tmdb.TmdbTranslationsResponse;
import movieservice.entity.*;
import movieservice.enums.MovieStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
public class TmdbService {

    private final MovieRepository movieRepository;
    private final MovieTranslationRepository movieTranslationRepository;
    private final MovieCastRepository movieCastRepository;
    private final PersonRepository personRepository;
    private final ProductionCompanyRepository productionCompanyRepository;
    private final ScreeningFormatRepository screeningFormatRepository;
    private final String apiKey;
    private final RestTemplate restTemplate;

    private static final String TMDB_BASE = "https://api.themoviedb.org/3";
    private static final String POSTER_BASE = "https://image.tmdb.org/t/p/w500";
    private static final int MAX_CAST = 15;

    public TmdbService(
            MovieRepository movieRepository,
            MovieTranslationRepository movieTranslationRepository,
            MovieCastRepository movieCastRepository,
            PersonRepository personRepository,
            ProductionCompanyRepository productionCompanyRepository,
            ScreeningFormatRepository screeningFormatRepository,
            @Value("${tmdb.api-key}") String apiKey) {
        this.movieRepository = movieRepository;
        this.movieTranslationRepository = movieTranslationRepository;
        this.movieCastRepository = movieCastRepository;
        this.personRepository = personRepository;
        this.productionCompanyRepository = productionCompanyRepository;
        this.screeningFormatRepository = screeningFormatRepository;
        this.apiKey = apiKey;
        this.restTemplate = new RestTemplate();
    }

    // ── Search ────────────────────────────────────────────────

    public List<TmdbSearchResultItem> search(String query) {
        URI uri = UriComponentsBuilder.fromHttpUrl(TMDB_BASE + "/search/movie")
                .queryParam("api_key", apiKey)
                .queryParam("query", query)
                .queryParam("language", "vi")
                .build().encode().toUri();
        try {
            TmdbSearchResponse response = restTemplate.getForObject(uri, TmdbSearchResponse.class);
            if (response == null || response.getResults() == null) return List.of();
            return response.getResults().stream()
                    .map(item -> TmdbSearchResultItem.builder()
                            .tmdbId(item.getId())
                            .title(item.getTitle())
                            .originalTitle(item.getOriginalTitle())
                            .releaseDate(item.getReleaseDate())
                            .posterUrl(buildPosterUrl(item.getPosterPath()))
                            .overview(item.getOverview())
                            .build())
                    .collect(Collectors.toList());
        } catch (RestClientException e) {
            log.error("TMDB search failed [{}]: {}", e.getClass().getSimpleName(), e.getMessage());
            if (e.getCause() != null) log.error("  Caused by [{}]: {}", e.getCause().getClass().getSimpleName(), e.getCause().getMessage());
            throw new AppException(MovieErrorCode.TMDB_API_ERROR);
        }
    }

    // ── Import ────────────────────────────────────────────────

    @Transactional
    public TmdbImportResponse importMovie(Integer tmdbId) {
        // 1. Duplicate check
        if (movieRepository.existsByTmdbId(tmdbId)) {
            throw new AppException(MovieErrorCode.TMDB_MOVIE_ALREADY_EXISTS);
        }

        // 2. Fetch from TMDB
        TmdbMovieDetail detail = fetchMovieDetail(tmdbId);
        TmdbCreditsResponse credits = fetchCredits(tmdbId);
        TmdbTranslationsResponse translationsResp = fetchTranslations(tmdbId);

        // 3. Upsert production companies
        List<ProductionCompany> companies = new ArrayList<>();
        if (detail.getProductionCompanies() != null) {
            for (TmdbMovieDetail.TmdbCompany c : detail.getProductionCompanies()) {
                if (c.getName() != null && !c.getName().isBlank()) {
                    companies.add(upsertCompany(c));
                }
            }
        }

        // 4. Default 2D format
        List<ScreeningFormat> formats = new ArrayList<>();
        screeningFormatRepository.findByFormatCode("2D").ifPresent(formats::add);

        // 5. Build & save movie
        Movie movie = Movie.builder()
                .tmdbId(tmdbId)
                .imdbId(detail.getImdbId())
                .originalTitle(detail.getOriginalTitle())
                .originalLanguage(detail.getOriginalLanguage() != null ? detail.getOriginalLanguage() : "en")
                .durationMinutes(detail.getRuntime() != null && detail.getRuntime() > 0
                        ? detail.getRuntime() : 90)
                .releaseDate(parseDate(detail.getReleaseDate()))
                .posterUrl(buildPosterUrl(detail.getPosterPath()))
                .synopsis(detail.getOverview())
                .status(MovieStatus.DRAFT)
                .company(companies.isEmpty() ? null : companies.get(0))
                .formats(formats)
                .genres(new ArrayList<>())
                .build();
        movie = movieRepository.save(movie);

        // 6. Translations
        saveTranslations(movie, detail, translationsResp);

        // 7. Cast (directors + top 15 actors)
        int castCount = saveCast(movie, credits);

        return TmdbImportResponse.builder()
                .movieId(movie.getMovieId())
                .tmdbId(tmdbId)
                .originalTitle(movie.getOriginalTitle())
                .status("DRAFT")
                .importedCastCount(castCount)
                .importedCompanyCount(companies.size())
                .build();
    }

    // ── TMDB API calls ────────────────────────────────────────

    private TmdbMovieDetail fetchMovieDetail(Integer tmdbId) {
        URI uri = UriComponentsBuilder.fromHttpUrl(TMDB_BASE + "/movie/" + tmdbId)
                .queryParam("api_key", apiKey)
                .queryParam("language", "en")
                .build().toUri();
        try {
            TmdbMovieDetail detail = restTemplate.getForObject(uri, TmdbMovieDetail.class);
            if (detail == null) throw new AppException(MovieErrorCode.TMDB_API_ERROR);
            return detail;
        } catch (RestClientException e) {
            log.error("TMDB fetchMovieDetail failed for tmdbId={}: {}", tmdbId, e.getMessage());
            throw new AppException(MovieErrorCode.TMDB_API_ERROR);
        }
    }

    private TmdbCreditsResponse fetchCredits(Integer tmdbId) {
        URI uri = UriComponentsBuilder.fromHttpUrl(TMDB_BASE + "/movie/" + tmdbId + "/credits")
                .queryParam("api_key", apiKey)
                .build().toUri();
        try {
            TmdbCreditsResponse credits = restTemplate.getForObject(uri, TmdbCreditsResponse.class);
            return credits != null ? credits : new TmdbCreditsResponse();
        } catch (RestClientException e) {
            log.warn("TMDB fetchCredits failed for tmdbId={}: {}", tmdbId, e.getMessage());
            return new TmdbCreditsResponse();
        }
    }

    private TmdbTranslationsResponse fetchTranslations(Integer tmdbId) {
        URI uri = UriComponentsBuilder.fromHttpUrl(TMDB_BASE + "/movie/" + tmdbId + "/translations")
                .queryParam("api_key", apiKey)
                .build().toUri();
        try {
            TmdbTranslationsResponse tr = restTemplate.getForObject(uri, TmdbTranslationsResponse.class);
            return tr != null ? tr : new TmdbTranslationsResponse();
        } catch (RestClientException e) {
            log.warn("TMDB fetchTranslations failed for tmdbId={}: {}", tmdbId, e.getMessage());
            return new TmdbTranslationsResponse();
        }
    }

    // ── Upsert helpers ────────────────────────────────────────

    private ProductionCompany upsertCompany(TmdbMovieDetail.TmdbCompany tmdbCompany) {
        return productionCompanyRepository.findByName(tmdbCompany.getName())
                .orElseGet(() -> {
                    ProductionCompany c = new ProductionCompany();
                    c.setName(tmdbCompany.getName());
                    c.setCountry(tmdbCompany.getOriginCountry());
                    if (tmdbCompany.getLogoPath() != null) {
                        c.setLogoUrl(POSTER_BASE + tmdbCompany.getLogoPath());
                    }
                    c.setCreatedAt(LocalDateTime.now());
                    return productionCompanyRepository.save(c);
                });
    }

    private Person upsertPerson(Integer tmdbPersonId, String name, String profilePath) {
        return personRepository.findByTmdbId(tmdbPersonId)
                .orElseGet(() -> {
                    Person p = new Person();
                    p.setTmdbId(tmdbPersonId);
                    p.setFullName(name);
                    if (profilePath != null) {
                        p.setPhotoUrl(POSTER_BASE + profilePath);
                    }
                    p.setCreatedAt(LocalDateTime.now());
                    p.setUpdatedAt(LocalDateTime.now());
                    return personRepository.save(p);
                });
    }

    private void saveTranslations(Movie movie, TmdbMovieDetail detail,
            TmdbTranslationsResponse translationsResp) {

        Map<String, TmdbTranslationsResponse.TranslationData> transMap = new HashMap<>();
        if (translationsResp.getTranslations() != null) {
            for (TmdbTranslationsResponse.Translation t : translationsResp.getTranslations()) {
                if (("vi".equals(t.getIso6391()) || "en".equals(t.getIso6391()))
                        && t.getData() != null
                        && t.getData().getTitle() != null
                        && !t.getData().getTitle().isBlank()) {
                    transMap.put(t.getIso6391(), t.getData());
                }
            }
        }

        // English: fallback to originalTitle if TMDB has no en translation
        String enTitle = transMap.containsKey("en")
                ? transMap.get("en").getTitle()
                : detail.getOriginalTitle();
        String enOverview = transMap.containsKey("en")
                ? transMap.get("en").getOverview()
                : detail.getOverview();
        saveOneTranslation(movie, "en", enTitle, enOverview);

        // Vietnamese: only if TMDB has it
        if (transMap.containsKey("vi")) {
            TmdbTranslationsResponse.TranslationData vi = transMap.get("vi");
            saveOneTranslation(movie, "vi", vi.getTitle(), vi.getOverview());
        }
    }

    private void saveOneTranslation(Movie movie, String langCode, String title, String synopsis) {
        MovieTranslationId id = new MovieTranslationId(movie.getMovieId(), langCode);
        MovieTranslation t = new MovieTranslation();
        t.setId(id);
        t.setMovie(movie);
        t.setTitle(title != null ? title : movie.getOriginalTitle());
        t.setSynopsis(synopsis);
        movieTranslationRepository.save(t);
    }

    private int saveCast(Movie movie, TmdbCreditsResponse credits) {
        int count = 0;

        // Directors from crew
        if (credits.getCrew() != null) {
            for (TmdbCreditsResponse.CrewMember c : credits.getCrew()) {
                if ("Director".equals(c.getJob()) && c.getId() != null) {
                    Person person = upsertPerson(c.getId(), c.getName(), c.getProfilePath());
                    saveCastEntry(movie, person, "DIRECTOR", null, null);
                    count++;
                }
            }
        }

        // Top actors
        if (credits.getCast() != null) {
            List<TmdbCreditsResponse.CastMember> top = credits.getCast().stream()
                    .filter(c -> c.getId() != null)
                    .sorted(Comparator.comparingInt(c -> (c.getOrder() != null ? c.getOrder() : 999)))
                    .limit(MAX_CAST)
                    .collect(Collectors.toList());
            for (int i = 0; i < top.size(); i++) {
                TmdbCreditsResponse.CastMember c = top.get(i);
                Person person = upsertPerson(c.getId(), c.getName(), c.getProfilePath());
                saveCastEntry(movie, person, "ACTOR", c.getCharacter(), i + 1);
                count++;
            }
        }

        return count;
    }

    private void saveCastEntry(Movie movie, Person person, String roleType,
            String characterName, Integer billingOrder) {
        MovieCast cast = MovieCast.builder()
                .movie(movie)
                .person(person)
                .roleType(roleType)
                .characterName(characterName)
                .billingOrder(billingOrder)
                .build();
        movieCastRepository.save(cast);
    }

    // ── Utilities ─────────────────────────────────────────────

    private String buildPosterUrl(String posterPath) {
        return posterPath != null ? POSTER_BASE + posterPath : null;
    }

    private LocalDate parseDate(String dateStr) {
        if (dateStr == null || dateStr.isBlank()) return null;
        try {
            return LocalDate.parse(dateStr);
        } catch (Exception e) {
            return null;
        }
    }
}
