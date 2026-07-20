package movieservice.service;

import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import movieservice.dto.request.TmdbImportRequest;
import movieservice.dto.response.MovieMediaCandidateResponse;
import movieservice.dto.response.MovieMediaPreviewResponse;
import movieservice.dto.response.TmdbCastPreview;
import movieservice.dto.response.TmdbCompanyPreview;
import movieservice.dto.response.TmdbGenrePreview;
import movieservice.dto.response.TmdbGenreSyncResponse;
import movieservice.dto.response.TmdbImportResponse;
import movieservice.dto.response.TmdbMovieDetailsResponse;
import movieservice.dto.response.TmdbSearchResultItem;
import movieservice.dto.response.TranslationResponse;
import movieservice.dto.tmdb.TmdbCastDraft;
import movieservice.dto.tmdb.TmdbCompanyDraft;
import movieservice.dto.tmdb.TmdbConfigurationResponse;
import movieservice.dto.tmdb.TmdbCreditsResponse;
import movieservice.dto.tmdb.TmdbGenreDraft;
import movieservice.dto.tmdb.TmdbGenreListResponse;
import movieservice.dto.tmdb.TmdbImagesResponse;
import movieservice.dto.tmdb.TmdbMovieDetail;
import movieservice.dto.tmdb.TmdbMovieDraft;
import movieservice.dto.tmdb.TmdbReleaseDatesResponse;
import movieservice.dto.tmdb.TmdbSearchResponse;
import movieservice.dto.tmdb.TmdbTranslationsResponse;
import movieservice.dto.tmdb.TmdbVideosResponse;
import movieservice.dto.tmdb.TranslationDraft;
import movieservice.entity.*;
import movieservice.enums.GenreStatus;
import movieservice.enums.MovieStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.TmdbDraftMapper;
import movieservice.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * TMDB-FIX-02: getDetails() (preview) and importMovie() (the real import command) both fetch via
 * fetchAll() and map via TmdbDraftMapper.toDraft() - the same pure, repository-free draft - so
 * they cannot silently diverge on runtime, cast, translations or genre extraction. Everything
 * downstream of the draft (matching companies/persons/genres/age-rating against the database) is
 * local resolution and lives here, not in the mapper.
 */
@Service
@Slf4j
public class TmdbService {

    private final MovieRepository movieRepository;
    private final MovieTranslationRepository movieTranslationRepository;
    private final MovieCastRepository movieCastRepository;
    private final PersonRepository personRepository;
    private final ProductionCompanyRepository productionCompanyRepository;
    private final GenreRepository genreRepository;
    private final AgeRatingRepository ageRatingRepository;
    private final String apiKey;
    private final int maxStills;
    private final RestTemplate restTemplate;

    private static final String TMDB_BASE = "https://api.themoviedb.org/3";

    // include_image_language=vi,en,null - TMDB-FIX-05: prefer Vietnamese, then English,
    // then textless (no-language) assets over any other locale.
    private static final String IMAGE_LANGUAGE_PARAM = "vi,en,null";
    private static final List<String> LANGUAGE_PRIORITY = List.of("vi", "en", "");

    // TMDB's own aspect ratios have natural jitter (2.03, 1.777..., 1.78...) - tolerate a
    // reasonable band around the canonical ratio rather than requiring an exact match.
    private static final double POSTER_ASPECT_MIN = 0.5;
    private static final double POSTER_ASPECT_MAX = 0.8;
    private static final double BACKDROP_ASPECT_MIN = 1.5;
    private static final double BACKDROP_ASPECT_MAX = 2.0;

    private static final String PREFERRED_POSTER_SIZE = "w780";
    private static final String PREFERRED_THUMBNAIL_SIZE = "w342";
    private static final String PREFERRED_BACKDROP_SIZE = "w1280";

    // [Backend] Fetch and select an official TMDB trailer: only YouTube-hosted videos are
    // eligible (the only provider trailerUrl is ever built for), Trailer type is preferred
    // over Teaser, and vi/en locales are preferred over any other language.
    private static final String TRAILER_SITE = "YouTube";
    private static final String TRAILER_TYPE = "Trailer";
    private static final String TEASER_TYPE = "Teaser";
    private static final String TRAILER_PROVIDER = "YOUTUBE";
    private static final List<String> TRAILER_LANGUAGE_PRIORITY = List.of("vi", "en");

    /** Fetched once and cached - TMDB's image configuration (base URL, available size profiles)
     *  is effectively static for the lifetime of the app. */
    private volatile TmdbConfigurationResponse cachedConfig;

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

    // TMDB genre ID → genre_code in local DB. Legacy/migration fallback only - genreRepository
    // .findByTmdbGenreId() (Genre.tmdbGenreId, TMDB-FIX-03) is now the primary, stable match.
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
            GenreRepository genreRepository,
            AgeRatingRepository ageRatingRepository,
            @Value("${tmdb.api-key}") String apiKey,
            @Value("${tmdb.image.max-stills:10}") int maxStills) {
        this.movieRepository = movieRepository;
        this.movieTranslationRepository = movieTranslationRepository;
        this.movieCastRepository = movieCastRepository;
        this.personRepository = personRepository;
        this.productionCompanyRepository = productionCompanyRepository;
        this.genreRepository = genreRepository;
        this.ageRatingRepository = ageRatingRepository;
        this.apiKey = apiKey;
        this.maxStills = maxStills;
        this.restTemplate = new RestTemplate();
    }

    public int getMaxStills() {
        return maxStills;
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
        Map<Integer, Long> localMovieIdByTmdbId = tmdbIds.isEmpty()
                ? Map.of()
                : movieRepository.findExistingTmdbIdsWithMovieId(tmdbIds).stream()
                        .collect(Collectors.toMap(
                                MovieRepository.TmdbIdAndMovieId::getTmdbId,
                                MovieRepository.TmdbIdAndMovieId::getMovieId));
        return items.stream()
                .map(item -> TmdbSearchResultItem.builder()
                        .tmdbId(item.getId())
                        .title(item.getTitle())
                        .originalTitle(item.getOriginalTitle())
                        .releaseDate(item.getReleaseDate())
                        .posterUrl(item.getPosterPath() != null ? TmdbDraftMapper.POSTER_BASE + item.getPosterPath() : null)
                        .overview(item.getOverview())
                        .alreadyImported(item.getId() != null && localMovieIdByTmdbId.containsKey(item.getId()))
                        .localMovieId(item.getId() != null ? localMovieIdByTmdbId.get(item.getId()) : null)
                        .build())
                .collect(Collectors.toList());
    }

    // ── Preview (read-only) ──────────────────────────────────────

    /**
     * Issue #188: preview thuan doc, KHONG duoc mo write transaction va KHONG duoc goi save()
     * len bat ky repository nao. TMDB-FIX-02: dung chung fetchAll()+TmdbDraftMapper.toDraft() voi
     * importMovie() nen khong the lech nhau ve runtime/cast/translations/genre. TMDB-FIX-03:
     * genre unmapped van duoc tra ve (khong bi bo khoi preview), kem mappingStatus ro rang.
     */
    public TmdbMovieDetailsResponse getDetails(Integer tmdbId) {
        TmdbFetchBundle bundle = fetchAll(tmdbId);
        TmdbMovieDraft draft = TmdbDraftMapper.toDraft(bundle.detail(), bundle.credits(), bundle.translations());

        List<TmdbCompanyPreview> companies = draft.getCompanies().stream()
                .map(this::previewCompany)
                .collect(Collectors.toList());

        List<TmdbCastPreview> cast = draft.getCast().stream()
                .map(this::previewCastMember)
                .collect(Collectors.toList());

        List<GenreMatch> genreMatches = resolveGenreMatches(draft.getGenres());
        List<TmdbGenrePreview> genrePreviews = genreMatches.stream()
                .map(this::toGenrePreview)
                .collect(Collectors.toList());

        AgeRating resolvedRating = resolveAgeRating(bundle.releaseDates());

        List<String> warnings = new ArrayList<>(draft.getWarnings());
        genreMatches.stream()
                .filter(m -> m.mappingStatus() == GenreMappingStatus.UNMAPPED)
                .forEach(m -> warnings.add("GENRE_UNMAPPED:" + m.tmdbGenreId()));

        PosterMedia posterMedia = resolvePosterMedia(tmdbId, draft.getPosterUrl());
        if (posterMedia.media().getRecommendedPosterPath() == null && draft.getPosterUrl() == null) {
            warnings.add("POSTER_NOT_AVAILABLE");
        }

        TrailerSelection trailer = selectTrailer(bundle.videos(), warnings);

        return TmdbMovieDetailsResponse.builder()
                .tmdbId(tmdbId)
                .imdbId(draft.getImdbId())
                .originalTitle(draft.getOriginalTitle())
                .originalLanguage(draft.getOriginalLanguage())
                .durationMinutes(draft.getRuntimeMinutes())
                .releaseDate(draft.getReleaseDate())
                .country(draft.getCountry())
                .posterUrl(posterMedia.posterUrl())
                .thumbnailUrl(posterMedia.thumbnailUrl())
                .overview(draft.getOverview())
                .tagline(draft.getTagline())
                .media(posterMedia.media())
                .trailerUrl(trailer != null ? trailer.url() : null)
                .trailerProvider(trailer != null ? trailer.provider() : null)
                .trailerExternalKey(trailer != null ? trailer.externalKey() : null)
                .trailerLanguageCode(trailer != null ? trailer.languageCode() : null)
                .trailerVideoType(trailer != null ? trailer.videoType() : null)
                .trailerOfficial(trailer != null ? trailer.official() : null)
                .companies(companies)
                .translations(toTranslationResponses(draft.getTranslations()))
                .cast(cast)
                .genres(genrePreviews)
                .ageRatingId(resolvedRating != null ? resolvedRating.getRatingId() : null)
                .warnings(warnings)
                .build();
    }

    private record PosterMedia(String posterUrl, String thumbnailUrl, MovieMediaPreviewResponse media) {
    }

    /**
     * Shared by getDetails() (preview) and importMovie() so both compute the movie-level
     * posterUrl/thumbnailUrl the exact same way (TMDB-FIX-02 precedent) - fixes the original bug
     * where the frontend copied one TMDB poster string into both fields. thumbnailUrl is always a
     * genuinely smaller CDN size profile of the same recommended poster, never a raw copy.
     */
    private PosterMedia resolvePosterMedia(Integer tmdbId, String fallbackPosterUrl) {
        TmdbImagesResponse imagesResponse = fetchImages(tmdbId);
        TmdbConfigurationResponse config = getImageConfig();
        MovieMediaPreviewResponse media = buildMediaPreview(imagesResponse, config, maxStills);

        String posterUrl = media.getRecommendedPosterPath() != null
                ? buildSizedUrl(config, media.getRecommendedPosterPath(), PREFERRED_POSTER_SIZE)
                : fallbackPosterUrl;
        String thumbnailUrl = media.getRecommendedPosterPath() != null
                ? buildSizedUrl(config, media.getRecommendedPosterPath(), PREFERRED_THUMBNAIL_SIZE)
                : fallbackPosterUrl;
        return new PosterMedia(posterUrl, thumbnailUrl, media);
    }

    // ── Import ────────────────────────────────────────────────

    @Transactional
    public TmdbImportResponse importMovie(TmdbImportRequest request) {
        Integer tmdbId = request.getTmdbId();

        // 1. Duplicate check by tmdbId (cheap, before any HTTP call)
        if (movieRepository.existsByTmdbId(tmdbId)) {
            throw new AppException(MovieErrorCode.TMDB_MOVIE_ALREADY_EXISTS);
        }

        // 2. Fetch + map - same pipeline as preview, cannot diverge
        TmdbFetchBundle bundle = fetchAll(tmdbId);
        TmdbMovieDraft draft = TmdbDraftMapper.toDraft(bundle.detail(), bundle.credits(), bundle.translations());

        // 2b. Duplicate check by imdbId (only known after fetch)
        if (draft.getImdbId() != null && movieRepository.existsByImdbId(draft.getImdbId())) {
            throw new AppException(MovieErrorCode.TMDB_MOVIE_ALREADY_EXISTS);
        }

        // 3. Runtime - never silently default to a placeholder (TMDB-FIX-02)
        Integer runtimeMinutes = draft.getRuntimeMinutes();
        if (runtimeMinutes == null) {
            runtimeMinutes = request.getConfirmedRuntimeMinutes();
            if (runtimeMinutes == null || runtimeMinutes <= 0) {
                throw new AppException(MovieErrorCode.MISSING_RUNTIME);
            }
        }

        // 4. Genres - never silently dropped, never auto-created ACTIVE (TMDB-FIX-03)
        List<String> warnings = new ArrayList<>(draft.getWarnings());
        List<Genre> resolvedGenres = resolveGenresForImport(
                resolveGenreMatches(draft.getGenres()), request, warnings);

        // 5. Companies - issue #151: all TMDB-listed companies are linked, not just the first.
        // ProductionCompany has no @EqualsAndHashCode, so a LinkedHashSet dedupes by reference
        // identity - correct here because upsertCompany() returns the SAME managed instance for
        // repeated matches within this persistence context (JPA first-level cache), while two
        // genuinely distinct new companies (both with a null, not-yet-assigned companyId) are
        // never mistaken for one another. Preserves TMDB's original ordering.
        Set<ProductionCompany> uniqueCompanies = new LinkedHashSet<>();
        for (TmdbCompanyDraft c : draft.getCompanies()) {
            uniqueCompanies.add(upsertCompany(c));
        }
        List<ProductionCompany> companies = new ArrayList<>(uniqueCompanies);

        // 6. Age rating - admin confirmation overrides auto-resolution
        AgeRating resolvedRating;
        if (request.getConfirmedAgeRatingId() != null) {
            resolvedRating = ageRatingRepository.findById(request.getConfirmedAgeRatingId())
                    .orElseThrow(() -> new AppException(MovieErrorCode.AGE_RATING_NOT_FOUND));
        } else {
            resolvedRating = resolveAgeRating(bundle.releaseDates());
        }

        // 7. Screening format - never inferred from movie master; belongs to release-version/showtime
        warnings.add("SCREENING_FORMAT_NOT_SET");

        // 7b. Poster + thumbnail - same resolution logic as preview (TMDB-FIX-02), never a
        // straight copy of the same URL into both fields.
        PosterMedia posterMedia = resolvePosterMedia(tmdbId, draft.getPosterUrl());

        // 7c. Trailer - same selection policy as preview; never blocks import if absent.
        TrailerSelection trailer = selectTrailer(bundle.videos(), warnings);

        // 8. Build & save movie - DRAFT only, never auto-published
        Movie movie = Movie.builder()
                .tmdbId(tmdbId)
                .imdbId(draft.getImdbId())
                .originalTitle(draft.getOriginalTitle())
                .originalLanguage(draft.getOriginalLanguage())
                .durationMinutes(runtimeMinutes)
                .releaseDate(parseDate(draft.getReleaseDate()))
                .country(draft.getCountry())
                .posterUrl(posterMedia.posterUrl())
                .thumbnailUrl(posterMedia.thumbnailUrl())
                .trailerUrl(trailer != null ? trailer.url() : null)
                .trailerProvider(trailer != null ? trailer.provider() : null)
                .trailerExternalKey(trailer != null ? trailer.externalKey() : null)
                .trailerLanguageCode(trailer != null ? trailer.languageCode() : null)
                .trailerVideoType(trailer != null ? trailer.videoType() : null)
                .trailerOfficial(trailer != null ? trailer.official() : null)
                .trailerSource(trailer != null ? "TMDB" : "MANUAL")
                .synopsis(draft.getOverview())
                .tagline(draft.getTagline())
                .taglineSource(draft.getTagline() != null ? "TMDB" : "MANUAL")
                .status(MovieStatus.DRAFT)
                .companies(companies)
                .formats(new ArrayList<>())
                .genres(resolvedGenres)
                .ageRating(resolvedRating)
                .build();
        try {
            movie = movieRepository.save(movie);
        } catch (DataIntegrityViolationException e) {
            // Closes the race window between the existsBy*() pre-checks above and this insert.
            throw new AppException(MovieErrorCode.TMDB_MOVIE_ALREADY_EXISTS);
        }

        // 9. Translations + cast, fed from the same draft used for preview
        saveTranslations(movie, draft.getTranslations());
        int castCount = saveCast(movie, draft.getCast());

        return TmdbImportResponse.builder()
                .movieId(movie.getMovieId())
                .tmdbId(tmdbId)
                .originalTitle(movie.getOriginalTitle())
                .status("DRAFT")
                .importedCastCount(castCount)
                .importedCompanyCount(companies.size())
                .warnings(warnings)
                .build();
    }

    // ── Genre taxonomy sync (read-only report) ────────────────

    /**
     * TMDB-FIX-03: compares TMDB's full genre taxonomy against local Genre.tmdbGenreId mappings.
     * Purely a report - never writes - so it's safe/idempotent regardless of concurrent imports.
     */
    public TmdbGenreSyncResponse syncGenres() {
        URI uri = UriComponentsBuilder.fromHttpUrl(TMDB_BASE + "/genre/movie/list")
                .queryParam("api_key", apiKey)
                .queryParam("language", "en")
                .build().toUri();
        TmdbGenreListResponse response;
        try {
            response = restTemplate.getForObject(uri, TmdbGenreListResponse.class);
        } catch (RestClientException e) {
            log.error("TMDB genre list fetch failed: {}", e.getMessage());
            throw new AppException(MovieErrorCode.TMDB_API_ERROR);
        }
        List<TmdbGenreListResponse.TmdbGenreEntry> entries =
                response != null && response.getGenres() != null ? response.getGenres() : List.of();

        int mapped = 0;
        List<TmdbGenreSyncResponse.UnmappedGenre> unmapped = new ArrayList<>();
        for (TmdbGenreListResponse.TmdbGenreEntry entry : entries) {
            if (entry.getId() != null && genreRepository.findByTmdbGenreId(entry.getId()).isPresent()) {
                mapped++;
            } else {
                unmapped.add(TmdbGenreSyncResponse.UnmappedGenre.builder()
                        .tmdbGenreId(entry.getId())
                        .name(entry.getName())
                        .status("PENDING_REVIEW")
                        .build());
            }
        }
        return TmdbGenreSyncResponse.builder().mapped(mapped).unmapped(unmapped).build();
    }

    // ── TMDB API calls ────────────────────────────────────────

    private record TmdbFetchBundle(
            TmdbMovieDetail detail,
            TmdbCreditsResponse credits,
            TmdbTranslationsResponse translations,
            TmdbReleaseDatesResponse releaseDates,
            TmdbVideosResponse videos) {
    }

    /** Groups the 5 HTTP calls behind getDetails()/importMovie() so both call the exact same fetch step. */
    private TmdbFetchBundle fetchAll(Integer tmdbId) {
        return new TmdbFetchBundle(
                fetchMovieDetail(tmdbId),
                fetchCredits(tmdbId),
                fetchTranslations(tmdbId),
                fetchReleaseDates(tmdbId),
                fetchVideos(tmdbId));
    }

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

    /** TMDB-FIX-05: posters/backdrops/logos, filtered to Vietnamese/English/textless assets. */
    TmdbImagesResponse fetchImages(Integer tmdbId) {
        URI uri = UriComponentsBuilder.fromHttpUrl(TMDB_BASE + "/movie/" + tmdbId + "/images")
                .queryParam("api_key", apiKey)
                .queryParam("include_image_language", IMAGE_LANGUAGE_PARAM)
                .build().toUri();
        try {
            TmdbImagesResponse r = restTemplate.getForObject(uri, TmdbImagesResponse.class);
            return r != null ? r : new TmdbImagesResponse();
        } catch (RestClientException e) {
            log.warn("TMDB fetchImages failed for tmdbId={}: {}", tmdbId, e.getMessage());
            return new TmdbImagesResponse();
        }
    }

    /** [Backend] Fetch and select an official TMDB trailer - GET /movie/{id}/videos. */
    TmdbVideosResponse fetchVideos(Integer tmdbId) {
        URI uri = UriComponentsBuilder.fromHttpUrl(TMDB_BASE + "/movie/" + tmdbId + "/videos")
                .queryParam("api_key", apiKey)
                .build().toUri();
        try {
            TmdbVideosResponse r = restTemplate.getForObject(uri, TmdbVideosResponse.class);
            return r != null ? r : new TmdbVideosResponse();
        } catch (RestClientException e) {
            log.warn("TMDB fetchVideos failed for tmdbId={}: {}", tmdbId, e.getMessage());
            return new TmdbVideosResponse();
        }
    }

    /** Cached - TMDB's image configuration (base URL, size profiles) is effectively static. */
    TmdbConfigurationResponse getImageConfig() {
        TmdbConfigurationResponse cached = cachedConfig;
        if (cached != null) return cached;
        URI uri = UriComponentsBuilder.fromHttpUrl(TMDB_BASE + "/configuration")
                .queryParam("api_key", apiKey)
                .build().toUri();
        try {
            TmdbConfigurationResponse fetched = restTemplate.getForObject(uri, TmdbConfigurationResponse.class);
            if (fetched == null || fetched.getImages() == null) {
                fetched = fallbackConfig();
            }
            cachedConfig = fetched;
            return fetched;
        } catch (RestClientException e) {
            log.warn("TMDB fetchConfiguration failed, using fallback size profile: {}", e.getMessage());
            return fallbackConfig();
        }
    }

    /** Only used if /configuration itself is unreachable - the same default TMDB has used for years. */
    private static TmdbConfigurationResponse fallbackConfig() {
        TmdbConfigurationResponse config = new TmdbConfigurationResponse();
        TmdbConfigurationResponse.Images images = new TmdbConfigurationResponse.Images();
        images.setSecureBaseUrl("https://image.tmdb.org/t/p/");
        images.setPosterSizes(List.of("w92", "w154", "w185", "w342", "w500", "w780", "original"));
        images.setBackdropSizes(List.of("w300", "w780", "w1280", "original"));
        config.setImages(images);
        return config;
    }

    /** Package-visible: reused by MovieImageService when persisting a selected TMDB image. */
    String resolveImageUrl(TmdbConfigurationResponse config, String filePath, movieservice.enums.MovieImageType type) {
        String preferredSize = type == movieservice.enums.MovieImageType.POSTER
                ? PREFERRED_POSTER_SIZE : PREFERRED_BACKDROP_SIZE;
        return buildSizedUrl(config, filePath, preferredSize);
    }

    String buildSizedUrl(TmdbConfigurationResponse config, String filePath, String preferredSize) {
        if (filePath == null) return null;
        TmdbConfigurationResponse.Images images = config.getImages();
        String baseUrl = images != null && images.getSecureBaseUrl() != null
                ? images.getSecureBaseUrl() : "https://image.tmdb.org/t/p/";
        List<String> available = preferredSize.startsWith("w7") || preferredSize.equals("w342")
                ? (images != null ? images.getPosterSizes() : null)
                : (images != null ? images.getBackdropSizes() : null);
        String size = pickSize(available, preferredSize);
        return baseUrl + size + filePath;
    }

    /** Uses the preferred size if TMDB's own configuration lists it as available, otherwise the
     *  closest smaller listed size, otherwise "original" - never silently hardcodes w500. */
    private String pickSize(List<String> available, String preferred) {
        if (available == null || available.isEmpty()) return preferred;
        if (available.contains(preferred)) return preferred;
        return available.contains("original") ? "original" : available.get(available.size() - 1);
    }

    /**
     * TMDB-FIX-05: normalizes raw TMDB images into ranked candidates. Selection weighs, in order:
     * (1) locale match (vi > en > textless > other), (2) TMDB vote_average, (3) resolution. Assets
     * with an aspect ratio outside a sane band for their category (mistagged uploads) are dropped.
     * TMDB's movie /images endpoint has no "stills" category - extra backdrops beyond the single
     * recommended one become our own STILL candidates, capped at maxStillsAllowed.
     */
    private MovieMediaPreviewResponse buildMediaPreview(
            TmdbImagesResponse images, TmdbConfigurationResponse config, int maxStillsAllowed) {

        List<TmdbImagesResponse.TmdbImageItem> posterItems = dedupeByFilePath(images.getPosters());
        List<TmdbImagesResponse.TmdbImageItem> backdropItems = dedupeByFilePath(images.getBackdrops());

        List<MovieMediaCandidateResponse> posters = rankCandidates(
                posterItems, config, PREFERRED_POSTER_SIZE, POSTER_ASPECT_MIN, POSTER_ASPECT_MAX);
        List<MovieMediaCandidateResponse> backdrops = rankCandidates(
                backdropItems, config, PREFERRED_BACKDROP_SIZE, BACKDROP_ASPECT_MIN, BACKDROP_ASPECT_MAX);

        String recommendedPosterPath = posters.isEmpty() ? null : posters.get(0).getFilePath();
        String recommendedBackdropPath = backdrops.isEmpty() ? null : backdrops.get(0).getFilePath();

        List<MovieMediaCandidateResponse> stills = backdrops.stream()
                .skip(backdrops.isEmpty() ? 0 : 1)
                .limit(Math.max(0, maxStillsAllowed))
                .collect(Collectors.toList());

        return MovieMediaPreviewResponse.builder()
                .recommendedPosterPath(recommendedPosterPath)
                .recommendedBackdropPath(recommendedBackdropPath)
                .posters(markRecommended(posters, recommendedPosterPath))
                .backdrops(markRecommended(backdrops, recommendedBackdropPath))
                .stills(stills)
                .build();
    }

    private List<TmdbImagesResponse.TmdbImageItem> dedupeByFilePath(List<TmdbImagesResponse.TmdbImageItem> items) {
        if (items == null) return List.of();
        Map<String, TmdbImagesResponse.TmdbImageItem> byPath = new LinkedHashMap<>();
        for (TmdbImagesResponse.TmdbImageItem item : items) {
            if (item.getFilePath() != null) byPath.putIfAbsent(item.getFilePath(), item);
        }
        return new ArrayList<>(byPath.values());
    }

    private List<MovieMediaCandidateResponse> rankCandidates(
            List<TmdbImagesResponse.TmdbImageItem> items, TmdbConfigurationResponse config,
            String preferredSize, double aspectMin, double aspectMax) {

        return items.stream()
                .filter(item -> item.getAspectRatio() == null
                        || (item.getAspectRatio() >= aspectMin && item.getAspectRatio() <= aspectMax))
                .sorted(Comparator
                        .comparingInt((TmdbImagesResponse.TmdbImageItem item) -> languageRank(item.getIso6391()))
                        .thenComparing(Comparator.comparingDouble(
                                (TmdbImagesResponse.TmdbImageItem item) ->
                                        item.getVoteAverage() != null ? item.getVoteAverage() : 0.0).reversed())
                        .thenComparing(Comparator.comparingInt(
                                (TmdbImagesResponse.TmdbImageItem item) -> resolutionOf(item)).reversed()))
                .map(item -> MovieMediaCandidateResponse.builder()
                        .filePath(item.getFilePath())
                        .url(buildSizedUrl(config, item.getFilePath(), preferredSize))
                        .width(item.getWidth())
                        .height(item.getHeight())
                        .aspectRatio(item.getAspectRatio())
                        .languageCode(normalizeLanguage(item.getIso6391()))
                        .voteAverage(item.getVoteAverage())
                        .recommended(false)
                        .build())
                .collect(Collectors.toList());
    }

    private int languageRank(String iso6391) {
        int rank = LANGUAGE_PRIORITY.indexOf(normalizeLanguage(iso6391));
        return rank >= 0 ? rank : LANGUAGE_PRIORITY.size();
    }

    private String normalizeLanguage(String iso6391) {
        return iso6391 == null ? "" : iso6391;
    }

    private int resolutionOf(TmdbImagesResponse.TmdbImageItem item) {
        if (item.getWidth() == null || item.getHeight() == null) return 0;
        return item.getWidth() * item.getHeight();
    }

    private List<MovieMediaCandidateResponse> markRecommended(
            List<MovieMediaCandidateResponse> candidates, String recommendedPath) {
        if (recommendedPath == null) return candidates;
        return candidates.stream()
                .map(c -> c.getFilePath().equals(recommendedPath)
                        ? MovieMediaCandidateResponse.builder()
                                .filePath(c.getFilePath()).url(c.getUrl()).width(c.getWidth())
                                .height(c.getHeight()).aspectRatio(c.getAspectRatio())
                                .languageCode(c.getLanguageCode()).voteAverage(c.getVoteAverage())
                                .recommended(true).build()
                        : c)
                .collect(Collectors.toList());
    }

    // ── Trailer selection ──────────────────────────────────────

    private record TrailerSelection(
            String provider, String externalKey, String languageCode,
            String videoType, boolean official, String url) {
    }

    /**
     * [Backend] Fetch and select an official TMDB trailer. Only YouTube-hosted videos are
     * eligible. Ranks by (1) official flag, (2) vi/en locale priority, then picks the first
     * Trailer-type candidate; falls back to a Teaser only if no Trailer exists at all, and
     * always records a warning when it does (never silently substitutes a teaser). Returns
     * null (with a TRAILER_NOT_FOUND warning) if TMDB has no eligible YouTube video at all -
     * this never blocks import, only the warning list is affected.
     */
    private TrailerSelection selectTrailer(TmdbVideosResponse videos, List<String> warnings) {
        List<TmdbVideosResponse.TmdbVideoItem> candidates = videos.getResults() == null
                ? List.of()
                : videos.getResults().stream()
                        .filter(v -> v.getKey() != null && !v.getKey().isBlank())
                        .filter(v -> TRAILER_SITE.equalsIgnoreCase(v.getSite()))
                        .collect(Collectors.toList());

        Comparator<TmdbVideosResponse.TmdbVideoItem> rank = Comparator
                .comparing((TmdbVideosResponse.TmdbVideoItem v) -> !Boolean.TRUE.equals(v.getOfficial()))
                .thenComparingInt(v -> trailerLanguageRank(v.getIso6391()));

        TmdbVideosResponse.TmdbVideoItem best = candidates.stream()
                .filter(v -> TRAILER_TYPE.equalsIgnoreCase(v.getType()))
                .min(rank)
                .orElse(null);

        boolean isTeaserFallback = false;
        if (best == null) {
            best = candidates.stream()
                    .filter(v -> TEASER_TYPE.equalsIgnoreCase(v.getType()))
                    .min(rank)
                    .orElse(null);
            isTeaserFallback = best != null;
        }

        if (best == null) {
            warnings.add("TRAILER_NOT_FOUND");
            return null;
        }

        if (isTeaserFallback) {
            warnings.add("TRAILER_FALLBACK_TEASER:" + best.getKey());
        }

        String url = "https://www.youtube.com/watch?v=" + best.getKey();
        String videoType = TEASER_TYPE.equalsIgnoreCase(best.getType()) ? "TEASER" : "TRAILER";
        return new TrailerSelection(
                TRAILER_PROVIDER, best.getKey(), best.getIso6391(),
                videoType, Boolean.TRUE.equals(best.getOfficial()), url);
    }

    private int trailerLanguageRank(String iso6391) {
        int rank = TRAILER_LANGUAGE_PRIORITY.indexOf(normalizeLanguage(iso6391));
        return rank >= 0 ? rank : TRAILER_LANGUAGE_PRIORITY.size();
    }

    // ── Company / person resolution ───────────────────────────

    /**
     * Issue #151: real upsert, only ever called from importMovie(), never from preview.
     * Matches primarily by the stable tmdbCompanyId - falls back to exact name only for
     * companies created before this field existed (migration-era rows) or manually via the
     * admin UI with no TMDB id yet. An existing row is enriched, never overwritten with nulls:
     * TMDB not providing a field (e.g. logoUrl) must never erase a locally-curated value.
     */
    private ProductionCompany upsertCompany(TmdbCompanyDraft company) {
        ProductionCompany existing = findExistingCompany(company);
        if (existing != null) {
            enrichCompany(existing, company);
            return productionCompanyRepository.save(existing);
        }

        ProductionCompany created = ProductionCompany.builder()
                .name(company.getName())
                .country(company.getCountry())
                .logoUrl(company.getLogoUrl())
                .tmdbCompanyId(company.getTmdbId())
                .createdAt(LocalDateTime.now())
                .build();
        try {
            return productionCompanyRepository.save(created);
        } catch (DataIntegrityViolationException e) {
            // Concurrent import created the same TMDB company (or same name) first - reuse it.
            ProductionCompany raced = findExistingCompany(company);
            if (raced == null) throw e;
            return raced;
        }
    }

    private ProductionCompany findExistingCompany(TmdbCompanyDraft company) {
        if (company.getTmdbId() != null) {
            ProductionCompany byTmdbId = productionCompanyRepository.findByTmdbCompanyId(company.getTmdbId()).orElse(null);
            if (byTmdbId != null) return byTmdbId;
        }
        return company.getName() != null
                ? productionCompanyRepository.findByName(company.getName()).orElse(null)
                : null;
    }

    /** Never nulls out an existing local value just because TMDB didn't provide one this time. */
    private void enrichCompany(ProductionCompany existing, TmdbCompanyDraft draft) {
        if (existing.getTmdbCompanyId() == null && draft.getTmdbId() != null) {
            existing.setTmdbCompanyId(draft.getTmdbId());
        }
        if (draft.getCountry() != null && !draft.getCountry().isBlank()) {
            existing.setCountry(draft.getCountry());
        }
        if (draft.getLogoUrl() != null && !draft.getLogoUrl().isBlank()) {
            existing.setLogoUrl(draft.getLogoUrl());
        }
    }

    /**
     * Issue #188: preview-only, read-only - KHONG duoc goi productionCompanyRepository.save().
     * Matching priority mirrors upsertCompany(): tmdbCompanyId first, exact name fallback.
     */
    private TmdbCompanyPreview previewCompany(TmdbCompanyDraft company) {
        ProductionCompany existing = findExistingCompany(company);
        return TmdbCompanyPreview.builder()
                .tmdbId(company.getTmdbId())
                .name(company.getName())
                .country(company.getCountry())
                .logoUrl(company.getLogoUrl())
                .localCompanyId(existing != null ? existing.getCompanyId() : null)
                .build();
    }

    /** Real upsert - only ever called from importMovie(), never from preview. */
    private Person upsertPerson(Integer tmdbPersonId, String name, String photoUrl,
                                String gender, String knownForDepartment) {
        return personRepository.findByTmdbId(tmdbPersonId)
                .orElseGet(() -> {
                    Person p = new Person();
                    p.setTmdbId(tmdbPersonId);
                    p.setFullName(name);
                    if (photoUrl != null) {
                        p.setPhotoUrl(photoUrl);
                    }
                    p.setGender(gender);
                    p.setKnownForDepartment(knownForDepartment);
                    p.setCreatedAt(LocalDateTime.now());
                    p.setUpdatedAt(LocalDateTime.now());
                    return personRepository.save(p);
                });
    }

    /**
     * Issue #188: preview-only - KHONG goi upsertPerson(). Chi tra du lieu tu TMDB kem localPersonId
     * neu person do da tung duoc import truoc day (tim theo tmdbId, read-only).
     */
    private TmdbCastPreview previewCastMember(TmdbCastDraft cast) {
        Person existing = personRepository.findByTmdbId(cast.getTmdbPersonId()).orElse(null);
        return TmdbCastPreview.builder()
                .tmdbId(cast.getTmdbPersonId())
                .fullName(existing != null ? existing.getFullName() : cast.getName())
                .photoUrl(existing != null ? existing.getPhotoUrl() : cast.getPhotoUrl())
                .roleType(cast.getRoleType())
                .characterName(cast.getCharacterName())
                .billingOrder(cast.getBillingOrder())
                .localPersonId(existing != null ? existing.getPersonId() : null)
                .build();
    }

    private List<TranslationResponse> toTranslationResponses(List<TranslationDraft> drafts) {
        return drafts.stream()
                .map(t -> TranslationResponse.builder()
                        .languageCode(t.getLanguageCode())
                        .title(t.getTitle())
                        .synopsis(t.getSynopsis())
                        .tagline(t.getTagline())
                        .build())
                .collect(Collectors.toList());
    }

    private void saveTranslations(Movie movie, List<TranslationDraft> translations) {
        for (TranslationDraft t : translations) {
            saveOneTranslation(movie, t.getLanguageCode(), t.getTitle(), t.getSynopsis(), t.getTagline());
        }
    }

    private void saveOneTranslation(Movie movie, String langCode, String title, String synopsis, String tagline) {
        MovieTranslationId id = new MovieTranslationId(movie.getMovieId(), langCode);
        MovieTranslation t = new MovieTranslation();
        t.setId(id);
        t.setMovie(movie);
        t.setTagline(tagline);
        t.setTitle(title != null ? title : movie.getOriginalTitle());
        t.setSynopsis(synopsis);
        movieTranslationRepository.save(t);
    }

    private int saveCast(Movie movie, List<TmdbCastDraft> castDrafts) {
        int count = 0;
        for (TmdbCastDraft c : castDrafts) {
            Person person = upsertPerson(c.getTmdbPersonId(), c.getName(), c.getPhotoUrl(),
                    c.getGender(), c.getKnownForDepartment());
            saveCastEntry(movie, person, c.getRoleType(), c.getCharacterName(), c.getBillingOrder());
            count++;
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

    // ── Genre resolution (shared by preview + import, TMDB-FIX-03) ────────

    private enum GenreMappingStatus { MAPPED, PENDING_REVIEW, UNMAPPED }

    private record GenreMatch(Integer tmdbGenreId, String name, Genre genre, GenreMappingStatus mappingStatus) {
    }

    /**
     * Matches TMDB genre drafts to local Genre entities, in priority order:
     *  (1) Genre.tmdbGenreId - stable, primary (TMDB-FIX-03).
     *  (2) legacy TMDB_GENRE_CODES → genre_code - migration/fallback only.
     *  (3) case-insensitive name match - fallback for custom/future genres.
     * Unmatched genres are returned as UNMAPPED, never dropped from the result.
     */
    private List<GenreMatch> resolveGenreMatches(List<TmdbGenreDraft> draftGenres) {
        if (draftGenres == null || draftGenres.isEmpty()) return List.of();

        List<Genre> allLocal = genreRepository.findAll();
        Map<String, Genre> byNameLower = allLocal.stream()
                .collect(Collectors.toMap(
                        g -> g.getGenreName().toLowerCase().trim(),
                        g -> g,
                        (a, b) -> a));

        List<GenreMatch> result = new ArrayList<>();
        for (TmdbGenreDraft tg : draftGenres) {
            Genre found = genreRepository.findByTmdbGenreId(tg.getTmdbGenreId()).orElse(null);
            if (found == null) {
                String code = TMDB_GENRE_CODES.get(tg.getTmdbGenreId());
                if (code != null) {
                    found = genreRepository.findByGenreCode(code).orElse(null);
                }
            }
            if (found == null && tg.getName() != null) {
                found = byNameLower.get(tg.getName().toLowerCase().trim());
            }

            GenreMappingStatus status;
            if (found == null) {
                status = GenreMappingStatus.UNMAPPED;
            } else if (found.getStatus() == GenreStatus.PENDING_REVIEW) {
                status = GenreMappingStatus.PENDING_REVIEW;
            } else {
                status = GenreMappingStatus.MAPPED;
            }
            result.add(new GenreMatch(tg.getTmdbGenreId(), tg.getName(), found, status));
        }
        return result;
    }

    private TmdbGenrePreview toGenrePreview(GenreMatch match) {
        return TmdbGenrePreview.builder()
                .tmdbGenreId(match.tmdbGenreId())
                .name(match.name())
                .localGenreId(match.genre() != null ? match.genre().getGenreId() : null)
                .mappingStatus(match.mappingStatus().name())
                .build();
    }

    /**
     * TMDB-FIX-03: resolves the final genre list for import. Already-matched genres attach
     * directly; unmatched ones are resolved only via an explicit admin decision on the request
     * (map to existing / create PENDING_REVIEW / ignore with reason) - anything left unresolved
     * blocks the import instead of being silently dropped or silently created as ACTIVE.
     */
    private List<Genre> resolveGenresForImport(
            List<GenreMatch> matches, TmdbImportRequest request, List<String> warnings) {

        Map<Integer, Long> selected = request.getSelectedGenreMappings() != null
                ? request.getSelectedGenreMappings() : Map.of();
        List<Integer> createPending = request.getCreatePendingGenres() != null
                ? request.getCreatePendingGenres() : List.of();
        Map<Integer, String> ignored = request.getIgnoredGenres() != null
                ? request.getIgnoredGenres() : Map.of();

        List<Genre> resolved = new ArrayList<>();
        List<Integer> unresolved = new ArrayList<>();

        for (GenreMatch match : matches) {
            if (match.genre() != null) {
                resolved.add(match.genre());
                continue;
            }
            Integer tmdbGenreId = match.tmdbGenreId();
            if (selected.containsKey(tmdbGenreId)) {
                Genre genre = genreRepository.findById(selected.get(tmdbGenreId))
                        .orElseThrow(() -> new AppException(MovieErrorCode.GENRE_NOT_FOUND));
                resolved.add(genre);
            } else if (createPending.contains(tmdbGenreId)) {
                resolved.add(createPendingReviewGenre(tmdbGenreId, match.name()));
            } else if (ignored.containsKey(tmdbGenreId)) {
                warnings.add("GENRE_IGNORED:" + tmdbGenreId + ":" + ignored.get(tmdbGenreId));
            } else {
                unresolved.add(tmdbGenreId);
            }
        }

        if (!unresolved.isEmpty()) {
            log.warn("importMovie(): unresolved TMDB genre mapping(s) {} - blocking import", unresolved);
            throw new AppException(MovieErrorCode.UNRESOLVED_GENRE_MAPPING);
        }
        return resolved;
    }

    /** Creates a new PENDING_REVIEW genre for a TMDB genre with no local match yet. */
    private Genre createPendingReviewGenre(Integer tmdbGenreId, String name) {
        Optional<Genre> existing = genreRepository.findByTmdbGenreId(tmdbGenreId);
        if (existing.isPresent()) return existing.get();

        Genre genre = Genre.builder()
                .genreName(name != null && !name.isBlank() ? name : ("TMDB Genre " + tmdbGenreId))
                .genreCode("TMDB_" + tmdbGenreId)
                .tmdbGenreId(tmdbGenreId)
                .status(GenreStatus.PENDING_REVIEW)
                .createdAt(LocalDateTime.now())
                .build();
        try {
            return genreRepository.save(genre);
        } catch (DataIntegrityViolationException e) {
            // Concurrent import created the same TMDB genre first - reuse it instead of failing.
            return genreRepository.findByTmdbGenreId(tmdbGenreId)
                    .orElseThrow(() -> new AppException(MovieErrorCode.UNRESOLVED_GENRE_MAPPING));
        }
    }

    // ── Utilities ─────────────────────────────────────────────

    private LocalDate parseDate(String dateStr) {
        if (dateStr == null || dateStr.isBlank()) return null;
        try {
            return LocalDate.parse(dateStr);
        } catch (Exception e) {
            return null;
        }
    }
}
