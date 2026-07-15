package movieservice.service;

import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import movieservice.dto.response.TmdbCastPreview;
import movieservice.dto.response.TmdbCompanyPreview;
import movieservice.dto.response.TmdbImportResponse;
import movieservice.dto.response.TmdbMovieDetailsResponse;
import movieservice.dto.response.TmdbSearchResultItem;
import movieservice.dto.response.TranslationResponse;
import movieservice.dto.tmdb.TmdbCreditsResponse;
import movieservice.dto.tmdb.TmdbMovieDetail;
import movieservice.dto.tmdb.TmdbReleaseDatesResponse;
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
    private final GenreRepository genreRepository;
    private final AgeRatingRepository ageRatingRepository;
    private final String apiKey;
    private final RestTemplate restTemplate;

    private static final String TMDB_BASE = "https://api.themoviedb.org/3";
    private static final String POSTER_BASE = "https://image.tmdb.org/t/p/w500";
    private static final int MAX_CAST = 15;

    /**
     * Maps US MPAA certification → local VN rating code.
     * VN certifications from TMDB (P/K/T13/T16/T18) already match local codes directly.
     */
    private static final Map<String, String> US_CERT_TO_LOCAL = Map.of(
            "G",     "P",
            "PG",    "K",
            "PG-13", "T13",
            "R",     "T18",
            "NC-17", "T18"
    );

    // TMDB genre ID → genre_code in local DB (stable slug, language-independent)
    private static final Map<Integer, String> TMDB_GENRE_CODES = Map.ofEntries(
            Map.entry(28,    "action"),
            Map.entry(12,    "adventure"),
            Map.entry(16,    "animation"),
            Map.entry(35,    "comedy"),
            Map.entry(80,    "crime"),
            Map.entry(99,    "documentary"),
            Map.entry(18,    "drama"),
            Map.entry(10751, "family"),
            Map.entry(14,    "fantasy"),
            Map.entry(36,    "history"),
            Map.entry(27,    "horror"),
            Map.entry(10402, "music"),
            Map.entry(9648,  "mystery"),
            Map.entry(10749, "romance"),
            Map.entry(878,   "sci-fi"),
            Map.entry(10770, "tv-movie"),
            Map.entry(53,    "thriller"),
            Map.entry(10752, "war"),
            Map.entry(37,    "western")
    );

    public TmdbService(
            MovieRepository movieRepository,
            MovieTranslationRepository movieTranslationRepository,
            MovieCastRepository movieCastRepository,
            PersonRepository personRepository,
            ProductionCompanyRepository productionCompanyRepository,
            ScreeningFormatRepository screeningFormatRepository,
            GenreRepository genreRepository,
            AgeRatingRepository ageRatingRepository,
            @Value("${tmdb.api-key}") String apiKey) {
        this.movieRepository = movieRepository;
        this.movieTranslationRepository = movieTranslationRepository;
        this.movieCastRepository = movieCastRepository;
        this.personRepository = personRepository;
        this.productionCompanyRepository = productionCompanyRepository;
        this.screeningFormatRepository = screeningFormatRepository;
        this.genreRepository = genreRepository;
        this.ageRatingRepository = ageRatingRepository;
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
            return mapToResultItems(response.getResults());
        } catch (RestClientException e) {
            log.error("TMDB search failed [{}]: {}", e.getClass().getSimpleName(), e.getMessage());
            if (e.getCause() != null) log.error("  Caused by [{}]: {}", e.getCause().getClass().getSimpleName(), e.getCause().getMessage());
            throw new AppException(MovieErrorCode.TMDB_API_ERROR);
        }
    }

    /**
     * Danh sach phim dang chieu rap theo khu vuc (Now Playing) - dung cho man hinh
     * "Browse & Import": admin chon truc tiep tu list thay vi phai go ten tim kiem.
     * Day la cach cac app quan ly catalog dua tren TMDB (vd Radarr/Sonarr-style browse UI)
     * thuong lam - dung lam nguon "curated list" mac dinh, con search() la phuong an du phong
     * cho phim khong nam trong now_playing (phim cu, phim indie, phim dac biet).
     * Luu y: TMDB now_playing la du lieu cong dong/toan cau, khong phai feed phat hanh chinh
     * thuc noi bo rap - phu hop lam MVP nhung khong nen dung thay the du lieu tu nha phat hanh
     * cho mot he thong san xuat that.
     */
    public List<TmdbSearchResultItem> getNowPlaying(String region, int page) {
        URI uri = UriComponentsBuilder.fromHttpUrl(TMDB_BASE + "/movie/now_playing")
                .queryParam("api_key", apiKey)
                .queryParam("region", (region == null || region.isBlank()) ? "VN" : region)
                .queryParam("page", page > 0 ? page : 1)
                .queryParam("language", "vi")
                .build().encode().toUri();
        try {
            TmdbSearchResponse response = restTemplate.getForObject(uri, TmdbSearchResponse.class);
            if (response == null || response.getResults() == null) return List.of();
            return mapToResultItems(response.getResults());
        } catch (RestClientException e) {
            log.error("TMDB now_playing failed [{}]: {}", e.getClass().getSimpleName(), e.getMessage());
            if (e.getCause() != null) log.error("  Caused by [{}]: {}", e.getCause().getClass().getSimpleName(), e.getCause().getMessage());
            throw new AppException(MovieErrorCode.TMDB_API_ERROR);
        }
    }

    /**
     * Danh sach phim sap ra mat (Upcoming) theo khu vuc - tab thu 2 cua man hinh "Browse & Import",
     * dung cho phim co release date trong tuong lai (khong nam trong cua so now_playing).
     * Cung pattern voi getNowPlaying(), chi khac path va nhan dinh nghia cua TMDB.
     */
    public List<TmdbSearchResultItem> getUpcoming(String region, int page) {
        URI uri = UriComponentsBuilder.fromHttpUrl(TMDB_BASE + "/movie/upcoming")
                .queryParam("api_key", apiKey)
                .queryParam("region", (region == null || region.isBlank()) ? "VN" : region)
                .queryParam("page", page > 0 ? page : 1)
                .queryParam("language", "vi")
                .build().encode().toUri();
        try {
            TmdbSearchResponse response = restTemplate.getForObject(uri, TmdbSearchResponse.class);
            if (response == null || response.getResults() == null) return List.of();
            return mapToResultItems(response.getResults());
        } catch (RestClientException e) {
            log.error("TMDB upcoming failed [{}]: {}", e.getClass().getSimpleName(), e.getMessage());
            if (e.getCause() != null) log.error("  Caused by [{}]: {}", e.getCause().getClass().getSimpleName(), e.getCause().getMessage());
            throw new AppException(MovieErrorCode.TMDB_API_ERROR);
        }
    }

    /**
     * Map TMDB movie items -> DTO cho FE, kem co "alreadyImported" tinh bang 1 truy van bulk
     * (tranh N+1 goi existsByTmdbId tung item mot).
     */
    private List<TmdbSearchResultItem> mapToResultItems(List<TmdbSearchResponse.MovieItem> items) {
        if (items.isEmpty()) return List.of();
        List<Integer> tmdbIds = items.stream()
                .map(TmdbSearchResponse.MovieItem::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        Set<Integer> existingIds = tmdbIds.isEmpty()
                ? Set.of()
                : new HashSet<>(movieRepository.findExistingTmdbIds(tmdbIds));
        return items.stream()
                .map(item -> TmdbSearchResultItem.builder()
                        .tmdbId(item.getId())
                        .title(item.getTitle())
                        .originalTitle(item.getOriginalTitle())
                        .releaseDate(item.getReleaseDate())
                        .posterUrl(buildPosterUrl(item.getPosterPath()))
                        .overview(item.getOverview())
                        .alreadyImported(item.getId() != null && existingIds.contains(item.getId()))
                        .build())
                .collect(Collectors.toList());
    }

    /**
     * Issue #188: preview thuan doc, KHONG duoc mo write transaction va KHONG duoc goi save()
     * len bat ky repository nao - GET phai la safe/idempotent request dung nghia HTTP semantics.
     * Truoc day method nay @Transactional va goi upsertCompany()/upsertPerson(), nghia la chi
     * can admin mo modal xem preview la da phat sinh row moi trong production_company/person.
     * Gio day company/cast chi duoc "tim thu" (read-only, khong tao moi) qua previewCompany()/
     * previewCastMember() - localCompanyId/localPersonId tra ve null neu chua tung import truoc do.
     * Viec tao that su (upsertCompany/upsertPerson) van con nguyen o importMovie(), chi chay
     * khi admin da xac nhan command import/create.
     */
    public TmdbMovieDetailsResponse getDetails(Integer tmdbId) {
        TmdbMovieDetail detail = fetchMovieDetail(tmdbId);
        TmdbCreditsResponse credits = fetchCredits(tmdbId);
        TmdbTranslationsResponse translations = fetchTranslations(tmdbId);

        List<TmdbCompanyPreview> companies = new ArrayList<>();
        if (detail.getProductionCompanies() != null) {
            for (TmdbMovieDetail.TmdbCompany company : detail.getProductionCompanies()) {
                if (company.getName() != null && !company.getName().isBlank()) {
                    companies.add(previewCompany(company));
                }
            }
        }

        String country = detail.getProductionCountries() == null
                ? null
                : detail.getProductionCountries().stream()
                        .map(TmdbMovieDetail.TmdbCountry::getName)
                        .filter(Objects::nonNull)
                        .filter(name -> !name.isBlank())
                        .collect(Collectors.joining(", "));

        List<Genre> matchedGenres = resolveGenres(detail.getGenres());
        TmdbReleaseDatesResponse releaseDates = fetchReleaseDates(tmdbId);
        AgeRating resolvedRating = resolveAgeRating(releaseDates);

        return TmdbMovieDetailsResponse.builder()
                .tmdbId(tmdbId)
                .imdbId(detail.getImdbId())
                .originalTitle(detail.getOriginalTitle())
                .originalLanguage(detail.getOriginalLanguage())
                .durationMinutes(detail.getRuntime())
                .releaseDate(detail.getReleaseDate())
                .country(country)
                .posterUrl(buildPosterUrl(detail.getPosterPath()))
                .overview(detail.getOverview())
                .companies(companies)
                .translations(buildTranslationPreview(detail, translations))
                .cast(buildCastPreview(credits))
                .genreIds(matchedGenres.stream().map(Genre::getGenreId).collect(Collectors.toList()))
                .ageRatingId(resolvedRating != null ? resolvedRating.getRatingId() : null)
                .build();
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

        // 4b. Resolve TMDB genres to local genres
        List<Genre> resolvedGenres = resolveGenres(detail.getGenres());

        // 4c. Resolve age rating from release dates
        TmdbReleaseDatesResponse releaseDates = fetchReleaseDates(tmdbId);
        AgeRating resolvedRating = resolveAgeRating(releaseDates);

        // 5. Build & save movie
        Movie movie = Movie.builder()
                .tmdbId(tmdbId)
                .imdbId(detail.getImdbId())
                .originalTitle(detail.getOriginalTitle())
                .originalLanguage(detail.getOriginalLanguage() != null ? detail.getOriginalLanguage() : "en")
                .durationMinutes(detail.getRuntime() != null && detail.getRuntime() > 0
                        ? detail.getRuntime() : 90)
                .releaseDate(parseDate(detail.getReleaseDate()))
                .country(detail.getProductionCountries() == null
                        ? null
                        : detail.getProductionCountries().stream()
                                .map(TmdbMovieDetail.TmdbCountry::getName)
                                .filter(Objects::nonNull)
                                .filter(name -> !name.isBlank())
                                .collect(Collectors.joining(", ")))
                .posterUrl(buildPosterUrl(detail.getPosterPath()))
                .synopsis(detail.getOverview())
                .status(MovieStatus.DRAFT)
                .company(companies.isEmpty() ? null : companies.get(0))
                .formats(formats)
                .genres(new ArrayList<>(resolvedGenres))
                .ageRating(resolvedRating)
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

    /**
     * Issue #188: preview-only, read-only - KHONG duoc goi productionCompanyRepository.save().
     * Chi tim company da ton tai theo ten (cung logic match voi upsertCompany() dung de import),
     * neu chua co thi localCompanyId = null. Viec tao company that su van chi xay ra trong
     * upsertCompany() (duoc goi tu importMovie()), khong doi.
     */
    private TmdbCompanyPreview previewCompany(TmdbMovieDetail.TmdbCompany tmdbCompany) {
        ProductionCompany existing = productionCompanyRepository.findByName(tmdbCompany.getName()).orElse(null);
        return TmdbCompanyPreview.builder()
                .tmdbId(tmdbCompany.getId())
                .name(tmdbCompany.getName())
                .country(tmdbCompany.getOriginCountry())
                .logoUrl(tmdbCompany.getLogoPath() != null ? POSTER_BASE + tmdbCompany.getLogoPath() : null)
                .localCompanyId(existing != null ? existing.getCompanyId() : null)
                .build();
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

    private List<TranslationResponse> buildTranslationPreview(
            TmdbMovieDetail detail,
            TmdbTranslationsResponse translationsResponse) {
        Map<String, TmdbTranslationsResponse.TranslationData> translationMap = new HashMap<>();
        if (translationsResponse.getTranslations() != null) {
            translationsResponse.getTranslations().stream()
                    .filter(item -> "vi".equals(item.getIso6391()) || "en".equals(item.getIso6391()))
                    .filter(item -> item.getData() != null)
                    .forEach(item -> translationMap.put(item.getIso6391(), item.getData()));
        }

        List<TranslationResponse> result = new ArrayList<>();
        TmdbTranslationsResponse.TranslationData english = translationMap.get("en");
        result.add(TranslationResponse.builder()
                .languageCode("en")
                .title(english != null && english.getTitle() != null
                        ? english.getTitle() : detail.getOriginalTitle())
                .synopsis(english != null && english.getOverview() != null
                        ? english.getOverview() : detail.getOverview())
                .build());

        TmdbTranslationsResponse.TranslationData vietnamese = translationMap.get("vi");
        if (vietnamese != null && vietnamese.getTitle() != null
                && !vietnamese.getTitle().isBlank()) {
            result.add(TranslationResponse.builder()
                    .languageCode("vi")
                    .title(vietnamese.getTitle())
                    .synopsis(vietnamese.getOverview())
                    .build());
        }
        return result;
    }

    /**
     * Issue #188: preview-only - KHONG goi upsertPerson() (se save() Person moi vao DB ngay
     * khi admin chi xem preview). Chi tra du lieu tu TMDB kem localPersonId neu person do da
     * tung duoc import truoc day (tim theo tmdbId, read-only qua personRepository.findByTmdbId).
     * Neu chua co thi localPersonId = null - viec tao Person that su chi xay ra trong saveCast()
     * (duoc goi tu importMovie()), khong doi.
     */
    private List<TmdbCastPreview> buildCastPreview(TmdbCreditsResponse credits) {
        List<TmdbCastPreview> result = new ArrayList<>();
        if (credits.getCrew() != null) {
            credits.getCrew().stream()
                    .filter(item -> "Director".equals(item.getJob()) && item.getId() != null)
                    .forEach(item -> result.add(previewCastMember(
                            item.getId(), item.getName(), item.getProfilePath(),
                            "DIRECTOR", null, null)));
        }
        if (credits.getCast() != null) {
            List<TmdbCreditsResponse.CastMember> actors = credits.getCast().stream()
                    .filter(item -> item.getId() != null)
                    .sorted(Comparator.comparingInt(
                            item -> item.getOrder() != null ? item.getOrder() : 999))
                    .limit(MAX_CAST)
                    .toList();
            for (int index = 0; index < actors.size(); index++) {
                TmdbCreditsResponse.CastMember item = actors.get(index);
                result.add(previewCastMember(
                        item.getId(), item.getName(), item.getProfilePath(),
                        "ACTOR", item.getCharacter(), index + 1));
            }
        }
        return result;
    }

    private TmdbCastPreview previewCastMember(Integer tmdbPersonId, String name, String profilePath,
            String roleType, String characterName, Integer billingOrder) {
        Person existing = personRepository.findByTmdbId(tmdbPersonId).orElse(null);
        return TmdbCastPreview.builder()
                .tmdbId(tmdbPersonId)
                .fullName(existing != null ? existing.getFullName() : name)
                .photoUrl(existing != null ? existing.getPhotoUrl() : buildPosterUrl(profilePath))
                .roleType(roleType)
                .characterName(characterName)
                .billingOrder(billingOrder)
                .localPersonId(existing != null ? existing.getPersonId() : null)
                .build();
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

    // ── Age rating resolution ─────────────────────────────────

    private TmdbReleaseDatesResponse fetchReleaseDates(Integer tmdbId) {
        URI uri = UriComponentsBuilder.fromHttpUrl(TMDB_BASE + "/movie/" + tmdbId + "/release_dates")
                .queryParam("api_key", apiKey)
                .build().toUri();
        try {
            TmdbReleaseDatesResponse r = restTemplate.getForObject(uri, TmdbReleaseDatesResponse.class);
            return r != null ? r : new TmdbReleaseDatesResponse();
        } catch (RestClientException e) {
            log.warn("TMDB fetchReleaseDates failed for tmdbId={}: {}", tmdbId, e.getMessage());
            return new TmdbReleaseDatesResponse();
        }
    }

    /**
     * Resolves local AgeRating from TMDB release dates.
     * Priority: (1) VN certification (matches local codes directly),
     *           (2) US MPAA certification mapped to local codes.
     */
    private AgeRating resolveAgeRating(TmdbReleaseDatesResponse releaseDates) {
        if (releaseDates == null || releaseDates.getResults() == null) return null;

        String vnCert = null;
        String usCert = null;

        for (TmdbReleaseDatesResponse.CountryRelease country : releaseDates.getResults()) {
            if (country.getReleaseDates() == null) continue;
            String cert = country.getReleaseDates().stream()
                    .filter(rd -> rd.getCertification() != null && !rd.getCertification().isBlank())
                    .map(TmdbReleaseDatesResponse.ReleaseDate::getCertification)
                    .findFirst().orElse(null);
            if (cert == null) continue;
            if ("VN".equals(country.getCountryCode())) vnCert = cert;
            if ("US".equals(country.getCountryCode())) usCert = cert;
        }

        // 1. Try VN cert first — already matches local codes (P, K, T13, T16, T18)
        if (vnCert != null) {
            Optional<AgeRating> found = ageRatingRepository.findByRatingCode(vnCert);
            if (found.isPresent()) return found.get();
        }

        // 2. Map US MPAA → local code
        if (usCert != null) {
            String localCode = US_CERT_TO_LOCAL.get(usCert);
            if (localCode != null) {
                return ageRatingRepository.findByRatingCode(localCode).orElse(null);
            }
        }

        return null;
    }

    // ── Genre resolution ──────────────────────────────────────

    /**
     * Matches a list of TMDB genre objects to local Genre entities.
     * Strategy: (1) TMDB ID → genre_code lookup (language-independent),
     *           (2) fallback: case-insensitive name match.
     */
    private List<Genre> resolveGenres(List<TmdbMovieDetail.TmdbGenre> tmdbGenres) {
        if (tmdbGenres == null || tmdbGenres.isEmpty()) return List.of();
        // Build name lookup as fallback
        List<Genre> allLocal = genreRepository.findAll();
        Map<String, Genre> byNameLower = allLocal.stream()
                .collect(Collectors.toMap(
                        g -> g.getGenreName().toLowerCase().trim(),
                        g -> g,
                        (a, b) -> a));
        List<Genre> result = new ArrayList<>();
        for (TmdbMovieDetail.TmdbGenre tg : tmdbGenres) {
            Genre found = null;
            // 1. Match by genre_code (stable, language-independent)
            String code = TMDB_GENRE_CODES.get(tg.getId());
            if (code != null) {
                found = genreRepository.findByGenreCode(code).orElse(null);
            }
            // 2. Fallback: case-insensitive name match (handles custom/future genres)
            if (found == null && tg.getName() != null) {
                found = byNameLower.get(tg.getName().toLowerCase().trim());
            }
            if (found != null && !result.contains(found)) result.add(found);
        }
        return result;
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
