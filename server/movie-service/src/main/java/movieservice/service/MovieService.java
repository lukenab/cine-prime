package movieservice.service;

import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import movieservice.dto.request.CastRequest;
import movieservice.dto.request.CreateMovieRequest;
import movieservice.dto.request.TranslationRequest;
import movieservice.dto.request.UpdateMovieRequest;
import movieservice.dto.response.MovieResponse;
import movieservice.dto.response.PublicMovieResponse;
import movieservice.entity.*;
import movieservice.enums.AvailabilityStatus;
import movieservice.enums.GenreStatus;
import movieservice.enums.MovieStatus;
import movieservice.enums.MovieSchedulingScoreSource;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.dto.response.ImageUploadResponse;
import movieservice.repository.*;
import org.springframework.data.domain.Page;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class MovieService {

    MovieRepository movieRepository;
    MovieMapper movieMapper;
    GenreRepository genreRepository;
    AgeRatingRepository ageRatingRepository;
    ProductionCompanyRepository productionCompanyRepository;
    PersonRepository personRepository;
    MovieCastRepository movieCastRepository;
    MovieTranslationRepository movieTranslationRepository;
    CinemaRoomService cinemaRoomService;
    ShowTimeService showTimeService;
    AuditLogService auditLogService;
    ImageStorageService imageStorageService;
    MovieReadinessValidator movieReadinessValidator;
    MovieAvailabilityRepository movieAvailabilityRepository;
    MovieStatusHistoryRepository movieStatusHistoryRepository;
    ShowTimeRepository showTimeRepository;
    MovieSchedulingProfileRepository movieSchedulingProfileRepository;

    private static final long MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

    // ── Create ────────────────────────────────────────────────

    @Transactional
    public MovieResponse createMovie(CreateMovieRequest request) {
        // Duplicate guard
        if (movieRepository.existsByOriginalTitleIgnoreCase(request.getOriginalTitle())) {
            throw new AppException(MovieErrorCode.MOVIE_ALREADY_EXISTS);
        }

        Movie movie = movieMapper.toMovie(request);
        movie.setStatus(MovieStatus.DRAFT);

        // Wire FK references
        if (request.getAgeRatingId() != null) {
            AgeRating ar = ageRatingRepository.findById(request.getAgeRatingId())
                    .orElseThrow(() -> new AppException(MovieErrorCode.AGE_RATING_NOT_FOUND));
            movie.setAgeRating(ar);
        }
        if (request.getCompanyIds() != null) {
            movie.setCompanies(resolveCompanies(request.getCompanyIds()));
        }

        // Genres
        List<Genre> genres = genreRepository.findAllByGenreIdIn(request.getGenreIds());
        if (genres.size() != request.getGenreIds().size()) {
            throw new AppException(MovieErrorCode.GENRE_NOT_FOUND);
        }
        movie.setGenres(genres);

        // Screening formats: never set here - movie.formats is derived exclusively from
        // MovieScreeningVersionService.ensureMovieFormatProjection() whenever a screening
        // version is added. A brand-new draft legitimately starts with none.

        Movie saved = movieRepository.save(movie);
        upsertSchedulingProfile(saved, request.getPopularityScore(), request.getPriorityOverride());

        // Translations — save và set thẳng vào entity để mapper có data
        if (request.getTranslations() != null) {
            List<MovieTranslation> translations = saveTranslations(saved, request.getTranslations());
            saved.setTranslations(translations);
        }

        // Cast — save và set thẳng vào entity
        if (request.getCast() != null) {
            List<MovieCast> cast = saveCast(saved, request.getCast());
            saved.setCast(cast);
        }

        auditLogService.logAction("SYSTEM", "Admin", "movie:" + saved.getMovieId(),
                "Created movie: " + saved.getOriginalTitle());

        MovieResponse response = movieMapper.toMovieResponse(saved);
        attachSchedulingProfile(response, saved.getMovieId());
        return response;
    }

    // ── Read ──────────────────────────────────────────────────

    @Transactional
    public MovieResponse getMovie(Long id) {
        Movie movie = movieRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.MOVIE_NOT_FOUND));
        movie.getTranslations().size();
        movie.getCast().size();
        movie.getGenres().size();
        movie.getFormats().size();
        MovieResponse response = movieMapper.toMovieResponse(movie);
        attachSchedulingProfile(response, movie.getMovieId());
        return response;
    }

    /** GET /api/movies/{id}?lang=vi — trả response với translations filter theo ngôn ngữ */
    @Transactional
    public MovieResponse getMovieByLang(Long id, String lang) {
        Movie movie = movieRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.MOVIE_NOT_FOUND));
        movie.getCast().size();
        movie.getGenres().size();
        movie.getFormats().size();
        MovieResponse response = movieMapper.toMovieResponse(movie);
        attachSchedulingProfile(response, movie.getMovieId());
        if (lang != null && !lang.isBlank() && response.getTranslations() != null) {
            response.setTranslations(
                    response.getTranslations().stream()
                            .filter(t -> lang.equalsIgnoreCase(t.getLanguageCode()))
                            .collect(Collectors.toList())
            );
        }
        return response;
    }

    /**
     * MOV-LC-07: displayStatus is derived from content approval + cluster
     * availability + showtimes, never from Movie.status directly. With a
     * clusterId, every field (including bookingAvailable/nextShowtimeAt) is
     * authoritative for that cluster. Without one, this is aggregate discovery
     * only — clusterId/nextShowtimeAt/bookingAvailable are not meaningful for a
     * specific cinema and must not be used to decide whether booking is possible.
     */
    @Transactional
    public List<PublicMovieResponse> findAllPublic(Long clusterId) {
        LocalDate today = LocalDate.now();
        LocalTime now = LocalTime.now();

        if (clusterId != null) {
            return movieAvailabilityRepository.findByCluster_ClusterId(clusterId).stream()
                    .filter(a -> isPubliclyVisible(a, today))
                    .map(availability -> toPublicMovieResponse(availability.getMovie(), clusterId, availability, today, now))
                    .collect(Collectors.toList());
        }

        List<MovieAvailability> relevant = movieAvailabilityRepository.search(null, null, null).stream()
                .filter(a -> isPubliclyVisible(a, today))
                .collect(Collectors.toList());

        Map<Long, Movie> movieById = new LinkedHashMap<>();
        Map<Long, Boolean> anySaleableByMovie = new LinkedHashMap<>();
        for (MovieAvailability a : relevant) {
            Long movieId = a.getMovie().getMovieId();
            movieById.putIfAbsent(movieId, a.getMovie());
            boolean saleableAtCluster = a.getStatus() == AvailabilityStatus.OPEN
                    && showTimeService.findNextSaleableShowTime(
                            movieId,
                            a.getCluster().getClusterId(),
                            today,
                            now
                    ).isPresent();
            anySaleableByMovie.merge(
                    movieId,
                    saleableAtCluster,
                    (existing, saleable) -> existing || saleable
            );
        }

        return movieById.values().stream()
                .map(movie -> toPublicMovieResponse(
                        movie,
                        Boolean.TRUE.equals(anySaleableByMovie.get(movie.getMovieId()))
                ))
                .collect(Collectors.toList());
    }

    /**
     * `[Backend] Separate public and internal movie catalog APIs`: GET /api/movies/public/{id}
     * uses the exact same visibility predicate as the list (isPubliclyVisible), so a movie that
     * wouldn't appear in the public list can never be fetched directly by guessing its ID either.
     * Not visible at all (wrong status, no open/planned availability anywhere, or not shown at
     * the requested cluster) always surfaces as the same MOVIE_NOT_FOUND a truly-missing ID
     * would - never a different error that would let a client distinguish "exists but hidden"
     * from "doesn't exist".
     */
    @Transactional
    public PublicMovieResponse getPublicMovieDetail(Long movieId, Long clusterId) {
        LocalDate today = LocalDate.now();
        LocalTime now = LocalTime.now();

        Movie movie = movieRepository.findById(movieId)
                .orElseThrow(() -> new AppException(MovieErrorCode.MOVIE_NOT_FOUND));

        List<MovieAvailability> visible = movieAvailabilityRepository.findByMovie_MovieId(movieId).stream()
                .filter(a -> clusterId == null || clusterId.equals(a.getCluster().getClusterId()))
                .filter(a -> isPubliclyVisible(a, today))
                .collect(Collectors.toList());

        if (visible.isEmpty()) {
            throw new AppException(MovieErrorCode.MOVIE_NOT_FOUND);
        }

        PublicMovieResponse response;
        if (clusterId != null) {
            response = toPublicMovieResponse(movie, clusterId, visible.get(0), today, now);
        } else {
            boolean anySaleable = visible.stream().anyMatch(a ->
                    a.getStatus() == AvailabilityStatus.OPEN
                            && showTimeService.findNextSaleableShowTime(
                                    movieId,
                                    a.getCluster().getClusterId(),
                                    today,
                                    now
                            ).isPresent()
            );
            response = toPublicMovieResponse(movie, anySaleable);
        }
        applyDetailFields(response, movie);
        return response;
    }

    /** Detail-only enrichment for getPublicMovieDetail() - see PublicMovieResponse javadoc
     *  for why findAllPublic() (list) deliberately skips this. */
    private void applyDetailFields(PublicMovieResponse response, Movie movie) {
        response.setTagline(movie.getTagline());
        response.setCountry(movie.getCountry());
        response.setOriginalLanguage(movie.getOriginalLanguage());
        response.setAgeRating(movie.getAgeRating() != null ? movieMapper.toAgeRatingResponse(movie.getAgeRating()) : null);
        response.setFormats(movie.getFormats() == null ? List.of()
                : movie.getFormats().stream().map(movieMapper::toScreeningFormatResponse).collect(Collectors.toList()));
        response.setCompanies(movie.getCompanies() == null ? List.of()
                : movie.getCompanies().stream().map(movieMapper::toProductionCompanyResponse).collect(Collectors.toList()));
        response.setTranslations(movie.getTranslations() == null ? List.of()
                : movie.getTranslations().stream().map(movieMapper::toTranslationResponse).collect(Collectors.toList()));
        response.setCast(movie.getCast() == null ? List.of()
                : movie.getCast().stream().map(movieMapper::toCastResponse).collect(Collectors.toList()));
        response.setImages(movie.getImages() == null ? List.of()
                : movie.getImages().stream().map(movieMapper::toMovieImageResponse).collect(Collectors.toList()));
    }

    /** Single source of truth for "can an anonymous/customer request see this availability
     *  window at all" - shared by findAllPublic() (list) and getPublicMovieDetail() (direct
     *  ID) so the two can never silently drift apart. */
    private static boolean isPubliclyVisible(MovieAvailability availability, LocalDate today) {
        return availability.getMovie().getStatus() == MovieStatus.APPROVED
                && (availability.getStatus() == AvailabilityStatus.PLANNED || availability.getStatus() == AvailabilityStatus.OPEN)
                && (availability.getShowingEndDate() == null || !availability.getShowingEndDate().isBefore(today));
    }

    private PublicMovieResponse toPublicMovieResponse(Movie movie, Long clusterId, MovieAvailability availability, LocalDate today, LocalTime now) {
        java.util.Optional<ShowTime> nextShowtime =
                showTimeService.findNextSaleableShowTime(movie.getMovieId(), clusterId, today, now);
        boolean nowShowing = availability.getStatus() == AvailabilityStatus.OPEN && nextShowtime.isPresent();
        return PublicMovieResponse.builder()
                .movieId(movie.getMovieId())
                .originalTitle(movie.getOriginalTitle())
                .posterUrl(movie.getPosterUrl())
                .thumbnailUrl(movie.getThumbnailUrl())
                .trailerUrl(movie.getTrailerUrl())
                .synopsis(movie.getSynopsis())
                .durationMinutes(movie.getDurationMinutes())
                .releaseDate(movie.getReleaseDate())
                .genres(mapGenres(movie))
                .displayStatus(nowShowing ? "NOW_SHOWING" : "COMING_SOON")
                .clusterId(clusterId)
                .clusterName(availability.getCluster() != null ? availability.getCluster().getClusterName() : null)
                .nextShowtimeAt(nextShowtime.map(st -> LocalDateTime.of(st.getShowDate(), st.getStartTime())).orElse(null))
                .bookingAvailable(nowShowing)
                .build();
    }

    /** Aggregate-discovery variant (no clusterId) — see findAllPublic javadoc. */
    private PublicMovieResponse toPublicMovieResponse(Movie movie, boolean anyClusterSaleable) {
        return PublicMovieResponse.builder()
                .movieId(movie.getMovieId())
                .originalTitle(movie.getOriginalTitle())
                .posterUrl(movie.getPosterUrl())
                .thumbnailUrl(movie.getThumbnailUrl())
                .trailerUrl(movie.getTrailerUrl())
                .synopsis(movie.getSynopsis())
                .durationMinutes(movie.getDurationMinutes())
                .releaseDate(movie.getReleaseDate())
                .genres(mapGenres(movie))
                .displayStatus(anyClusterSaleable ? "NOW_SHOWING" : "COMING_SOON")
                .bookingAvailable(false)
                .build();
    }

    /** Issue #151: distinct() first, same as genres/formats, so a request that repeats an ID
     *  isn't falsely rejected as NOT_FOUND. Empty list clears all companies. */
    private List<ProductionCompany> resolveCompanies(List<Long> companyIds) {
        List<Long> distinctIds = companyIds.stream().distinct().collect(Collectors.toList());
        if (distinctIds.isEmpty()) return new ArrayList<>();
        List<ProductionCompany> companies = productionCompanyRepository.findAllByCompanyIdIn(distinctIds);
        if (companies.size() != distinctIds.size()) {
            throw new AppException(MovieErrorCode.COMPANY_NOT_FOUND);
        }
        return companies;
    }

    private List<movieservice.dto.response.GenreResponse> mapGenres(Movie movie) {
        if (movie.getGenres() == null) return List.of();
        return movie.getGenres().stream().map(movieMapper::toGenreResponse).collect(Collectors.toList());
    }

    @Transactional
    public List<MovieResponse> findAll() {
        // Admin: all movies regardless of status
        return movieMapper.toMovieResponseList(movieRepository.findAll());
    }

    @Transactional
    public Page<MovieResponse> findPage(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return movieRepository.findAll(pageable).map(movieMapper::toMovieResponse);
    }

    /** GET /api/movies?q=avenger&status=APPROVED&genreId=1&date=2026-07-09 */
    @Transactional
    public Page<MovieResponse> findPageWithFilters(
            int page, int size,
            String q, MovieStatus status, Long genreId, LocalDate releaseDate) {
        Pageable pageable = PageRequest.of(page, size);
        String queryPattern = q == null || q.isBlank()
                ? null
                : "%" + q.trim().toLowerCase(java.util.Locale.ROOT) + "%";
        return movieRepository.findWithFilters(status, genreId, releaseDate, queryPattern, pageable)
                .map(movieMapper::toMovieResponse);
    }

    // ── Update ────────────────────────────────────────────────

    /**
     * Partial-update contract (issue #143):
     *  - Field khong xuat hien / null trong request -> KHONG doi (mapper dung
     *    NullValuePropertyMappingStrategy.IGNORE cho scalar; FK/collection tu kiem tra != null o day).
     *  - Collection = [] (khac null) -> xoa toan bo phan tu hien co.
     *  - Collection non-empty -> reconcile theo business key, KHONG xoa-sach-lam-lai (tranh doi
     *    castId/mat du lieu neu that bai giua chung, xem MovieCast.uk_movie_id_person_id_role_type).
     * Validate (duplicate key trong request, ID tham chieu ton tai) luon chay TRUOC khi xoa/ghi
     * bat ky ban ghi cast/translation nao trong cung 1 loi goi - neu that bai, @Transactional
     * rollback toan bo (scalar lan relationship) vi AppException la RuntimeException.
     */
    @Transactional
    public MovieResponse updateMovie(Long id, UpdateMovieRequest request) {
        Movie movie = movieRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.MOVIE_NOT_FOUND));

        // Only DRAFT is directly editable — a revision must go back through
        // start-revision first (CHANGES_REQUESTED -> DRAFT) before it can be edited again.
        if (movie.getStatus() != MovieStatus.DRAFT) {
            throw new AppException(MovieErrorCode.MOVIE_NOT_EDITABLE);
        }

        // 1) Scalar fields - null-safe qua @BeanMapping(IGNORE) tren mapper.
        movieMapper.updateMovieFromRequest(request, movie);

        // [Backend] Fetch and select an official TMDB trailer: a manually-entered trailerUrl
        // is an arbitrary admin-supplied string, not a parsed YouTube key - clear the TMDB
        // provenance fields and mark the source MANUAL so a future TMDB re-sync knows not to
        // overwrite this admin's choice.
        if (request.getTrailerUrl() != null) {
            movie.setTrailerSource("MANUAL");
            movie.setTrailerProvider(null);
            movie.setTrailerExternalKey(null);
            movie.setTrailerLanguageCode(null);
            movie.setTrailerVideoType(null);
            movie.setTrailerOfficial(null);
        }

        // `[Backend] Add tagline field to Movie and MovieTranslation entities`: same
        // TMDB/MANUAL provenance guard as trailerUrl above - a manually-edited tagline must
        // never be silently overwritten by a future TMDB re-sync.
        if (request.getTagline() != null) {
            movie.setTaglineSource("MANUAL");
        }

        // 2) FK don le - null nghia la khong doi (giu nguyen quan he hien tai).
        if (request.getAgeRatingId() != null) {
            movie.setAgeRating(ageRatingRepository.findById(request.getAgeRatingId())
                    .orElseThrow(() -> new AppException(MovieErrorCode.AGE_RATING_NOT_FOUND)));
        }
        if (request.getCompanyIds() != null) {
            movie.setCompanies(resolveCompanies(request.getCompanyIds()));
        }

        // 3) Genres / formats - distinct() truoc khi so sanh size, tranh false-NOT_FOUND khi
        // request lo gui trung ID (vi du [1,1,2] truoc day se bi tu choi oan vi repository chi
        // tra ve 2 ban ghi phan biet trong khi request co 3 phan tu).
        if (request.getGenreIds() != null) {
            List<Long> distinctGenreIds = request.getGenreIds().stream().distinct().collect(Collectors.toList());
            List<Genre> genres = genreRepository.findAllByGenreIdIn(distinctGenreIds);
            if (genres.size() != distinctGenreIds.size()) {
                throw new AppException(MovieErrorCode.GENRE_NOT_FOUND);
            }
            movie.setGenres(genres);
        }
        // movie.formats is never written here - it's derived exclusively from
        // MovieScreeningVersionService.ensureMovieFormatProjection(). This used to accept a
        // formatIds field from the editor form and overwrite the whole list on every save,
        // but the editor has no UI to manage it (formats are configured via the Screening
        // Versions sub-form instead) - the form's stale, always-empty snapshot from page load
        // silently wiped out real formats a screening version had just added, the moment the
        // admin next saved the draft.

        // 4) Translations / cast - reconcile thay vi delete-all-then-insert.
        if (request.getTranslations() != null) {
            reconcileTranslations(movie, request.getTranslations());
        }
        if (request.getCast() != null) {
            reconcileCast(movie, request.getCast());
        }

        Movie saved = movieRepository.save(movie);
        upsertSchedulingProfile(saved, request.getPopularityScore(), request.getPriorityOverride());
        MovieResponse response = movieMapper.toMovieResponse(saved);
        attachSchedulingProfile(response, saved.getMovieId());
        return response;
    }

    /**
     * Upserts the movie's scheduling profile row (movie_scheduling_profile) from the
     * popularityScore/priorityOverride carried on a create/update request.
     * popularityScore is NOT NULL in the DB, so a brand-new profile defaults it to ZERO when
     * omitted. On an existing profile, a null popularityScore/priorityOverride means
     * "don't touch" - same partial-update contract as every other scalar field on
     * UpdateMovieRequest (see updateMovie's javadoc). One consequence: once priorityOverride is
     * set, there is currently no way to clear it back to null through this API (same trade-off
     * already accepted for trailerUrl/tagline/end date elsewhere in this service).
     */
    private void upsertSchedulingProfile(Movie movie, BigDecimal popularityScore, BigDecimal priorityOverride) {
        MovieSchedulingProfile profile = movieSchedulingProfileRepository.findByMovie_MovieId(movie.getMovieId())
                .orElseGet(() -> MovieSchedulingProfile.builder()
                        .movie(movie)
                        .popularityScore(BigDecimal.ZERO)
                        .scoreSource(MovieSchedulingScoreSource.MANUAL)
                        .build());
        if (popularityScore != null) {
            profile.setPopularityScore(popularityScore);
            profile.setScoreSource(MovieSchedulingScoreSource.MANUAL);
        }
        if (priorityOverride != null) {
            profile.setPriorityOverride(priorityOverride);
        }
        movieSchedulingProfileRepository.save(profile);
    }

    /** Attaches movie_scheduling_profile fields to a MovieResponse for single-movie reads
     *  (getMovie/getMovieByLang/createMovie/updateMovie) - list reads (findAll/findPageWithFilters)
     *  deliberately skip this to avoid an extra query per row. */
    private void attachSchedulingProfile(MovieResponse response, Long movieId) {
        movieSchedulingProfileRepository.findByMovie_MovieId(movieId).ifPresent(profile -> {
            response.setPopularityScore(profile.getPopularityScore());
            response.setPriorityOverride(profile.getPriorityOverride());
            response.setScoreSource(profile.getScoreSource() != null ? profile.getScoreSource().name() : null);
        });
    }

    /**
     * Mutates an existing Hibernate-managed collection in place rather than replacing its
     * reference (movie.setTranslations(newList)/setCast(newList)) - replacing an
     * orphanRemoval=true collection's reference breaks Hibernate's orphan tracking for it,
     * surfacing as "A collection with orphan deletion was no longer referenced by the owning
     * entity instance" the next time anything in the same transaction forces a flush. Falls back
     * to a plain reference assignment when the target is null (e.g. a plain, not-yet-persisted
     * entity in a unit test) - nothing to orphan there since there's no existing collection.
     */
    private static <T> void replaceInPlace(List<T> target, List<T> replacement, java.util.function.Consumer<List<T>> setter) {
        if (target == null) {
            setter.accept(replacement);
        } else {
            target.clear();
            target.addAll(replacement);
        }
    }

    /**
     * Reconcile translations theo composite key (movieId, languageCode) - xem AC section 5
     * cua issue #143. Update tai cho neu key da ton tai (giu nguyen createdAt), insert moi neu
     * chua co, chi xoa nhung language khong con xuat hien trong request (neu request khong rong).
     */
    private void reconcileTranslations(Movie movie, List<TranslationRequest> requests) {
        List<MovieTranslation> existing = movieTranslationRepository.findById_MovieId(movie.getMovieId());

        if (requests.isEmpty()) {
            if (!existing.isEmpty()) movieTranslationRepository.deleteAll(existing);
            replaceInPlace(movie.getTranslations(), new ArrayList<>(), movie::setTranslations);
            return;
        }

        // Validate truoc: normalize languageCode va tu choi trung lap NGAY, truoc khi dong tay
        // vao bat ky ban ghi hien co nao.
        Map<String, TranslationRequest> byLang = new LinkedHashMap<>();
        for (TranslationRequest tr : requests) {
            String lang = tr.getLanguageCode().toLowerCase();
            if (byLang.containsKey(lang)) {
                throw new AppException(MovieErrorCode.DUPLICATE_TRANSLATION_LANGUAGE);
            }
            byLang.put(lang, tr);
        }

        Map<String, MovieTranslation> existingByLang = existing.stream()
                .collect(Collectors.toMap(
                        t -> t.getId().getLanguageCode().toLowerCase(),
                        Function.identity()));

        List<MovieTranslation> result = new ArrayList<>();
        for (Map.Entry<String, TranslationRequest> entry : byLang.entrySet()) {
            String lang = entry.getKey();
            TranslationRequest tr = entry.getValue();
            MovieTranslation translation = existingByLang.get(lang);
            if (translation != null) {
                // Update tai cho - giu nguyen composite key va createdAt.
                translation.setTitle(tr.getTitle());
                translation.setSynopsis(tr.getSynopsis());
                translation.setTagline(tr.getTagline());
            } else {
                translation = new MovieTranslation();
                translation.setId(new MovieTranslationId(movie.getMovieId(), lang));
                translation.setMovie(movie);
                translation.setTitle(tr.getTitle());
                translation.setSynopsis(tr.getSynopsis());
                translation.setTagline(tr.getTagline());
            }
            result.add(movieTranslationRepository.save(translation));
        }

        List<MovieTranslation> toRemove = existing.stream()
                .filter(t -> !byLang.containsKey(t.getId().getLanguageCode().toLowerCase()))
                .collect(Collectors.toList());
        if (!toRemove.isEmpty()) movieTranslationRepository.deleteAll(toRemove);

        replaceInPlace(movie.getTranslations(), result, movie::setTranslations);
    }

    /** Business key cho cast reconciliation - xem AC section 6 cua issue #143. */
    private record CastKey(Long personId, String roleType) {}

    /**
     * Reconcile cast theo business key (movieId, personId, roleType) - update tai cho (chi
     * characterName/billingOrder, castId giu nguyen) neu key da ton tai, insert moi neu chua co,
     * chi xoa nhung cast khong con trong request (neu request khong rong). Validate TAT CA
     * personId ton tai TRUOC khi xoa/ghi bat ky ban ghi nao (khong de tinh trang xoa xong moi
     * phat hien personId sai).
     */
    private void reconcileCast(Movie movie, List<CastRequest> requests) {
        List<MovieCast> existing = movieCastRepository.findByMovie_MovieId(movie.getMovieId());

        if (requests.isEmpty()) {
            if (!existing.isEmpty()) movieCastRepository.deleteAll(existing);
            replaceInPlace(movie.getCast(), new ArrayList<>(), movie::setCast);
            return;
        }

        // Validate truoc: normalize roleType (uppercase) va tu choi trung business key.
        Map<CastKey, CastRequest> byKey = new LinkedHashMap<>();
        for (CastRequest cr : requests) {
            CastKey key = new CastKey(cr.getPersonId(), cr.getRoleType().toUpperCase());
            if (byKey.containsKey(key)) {
                throw new AppException(MovieErrorCode.DUPLICATE_CAST_ENTRY);
            }
            byKey.put(key, cr);
        }

        // Validate tat ca personId ton tai TRUOC khi dong vao existing (delete/insert).
        Set<Long> personIds = byKey.keySet().stream().map(CastKey::personId).collect(Collectors.toSet());
        Map<Long, Person> personsById = personRepository.findAllById(personIds).stream()
                .collect(Collectors.toMap(Person::getPersonId, Function.identity()));
        if (personsById.size() != personIds.size()) {
            throw new AppException(MovieErrorCode.PERSON_NOT_FOUND);
        }

        Map<CastKey, MovieCast> existingByKey = existing.stream()
                .collect(Collectors.toMap(
                        c -> new CastKey(c.getPerson().getPersonId(), c.getRoleType().toUpperCase()),
                        Function.identity()));

        List<MovieCast> result = new ArrayList<>();
        for (Map.Entry<CastKey, CastRequest> entry : byKey.entrySet()) {
            CastKey key = entry.getKey();
            CastRequest cr = entry.getValue();
            MovieCast cast = existingByKey.get(key);
            if (cast != null) {
                // Update tai cho - chi mutable field, castId giu nguyen.
                cast.setCharacterName(cr.getCharacterName());
                cast.setBillingOrder(cr.getBillingOrder());
            } else {
                cast = MovieCast.builder()
                        .movie(movie)
                        .person(personsById.get(key.personId()))
                        .roleType(key.roleType())
                        .characterName(cr.getCharacterName())
                        .billingOrder(cr.getBillingOrder())
                        .build();
            }
            result.add(movieCastRepository.save(cast));
        }

        List<MovieCast> toRemove = existing.stream()
                .filter(c -> !byKey.containsKey(new CastKey(c.getPerson().getPersonId(), c.getRoleType().toUpperCase())))
                .collect(Collectors.toList());
        if (!toRemove.isEmpty()) movieCastRepository.deleteAll(toRemove);

        replaceInPlace(movie.getCast(), result, movie::setCast);
    }

    // ── Status transitions ────────────────────────────────────

    /**
     * TMDB-FIX-03: blocks DRAFT -> PENDING_REVIEW while the movie still has a genre that was
     * auto-created from an unmapped TMDB genre and hasn't been promoted to ACTIVE by a genre
     * admin yet (see TmdbService.createPendingReviewGenre()). Kept as its own specific error
     * (GENRE_PENDING_REVIEW) ahead of the generic MOV-03 gate below rather than folded into it,
     * so this pre-existing, already-tested behavior doesn't change shape.
     * MOV-03: also requires title/language/runtime/genre/format/date-range readiness
     * (MovieReadinessValidator.requireReadyForReview()) before allowing the transition.
     */
    @Transactional
    public MovieResponse submitForReview(Long id, String updatedBy) {
        Movie movie = requireStatus(id, MovieStatus.DRAFT);
        boolean hasPendingGenre = movie.getGenres() != null && movie.getGenres().stream()
                .anyMatch(g -> g.getStatus() == GenreStatus.PENDING_REVIEW);
        if (hasPendingGenre) {
            throw new AppException(MovieErrorCode.GENRE_PENDING_REVIEW);
        }
        movieReadinessValidator.requireReadyForReview(movie);
        return transitionTo(movie, MovieStatus.PENDING_REVIEW, updatedBy, null);
    }

    /**
     * PENDING_REVIEW → APPROVED. This is a pure content decision — it does NOT
     * make the movie public or on-sale anywhere; that is entirely a
     * MovieAvailability concern (MOV-LC-06). MOV-03: requires age classification,
     * primary image, synopsis/localized title and valid genre refs.
     */
    @Transactional
    public MovieResponse approveMovie(Long id, String updatedBy) {
        Movie movie = requireStatus(id, MovieStatus.PENDING_REVIEW);
        movieReadinessValidator.requireReadyForApproval(movie);
        return transitionTo(movie, MovieStatus.APPROVED, updatedBy, null);
    }

    /** PENDING_REVIEW → CHANGES_REQUESTED. Reason is mandatory and preserved on the movie. */
    @Transactional
    public MovieResponse requestChanges(Long id, String note, String updatedBy) {
        Movie movie = requireStatus(id, MovieStatus.PENDING_REVIEW);
        movie.setRejectionNote(note);
        return transitionTo(movie, MovieStatus.CHANGES_REQUESTED, updatedBy, note);
    }

    /** CHANGES_REQUESTED → DRAFT: author edits and resubmits. */
    @Transactional
    public MovieResponse startRevision(Long id, String updatedBy) {
        Movie movie = requireStatus(id, MovieStatus.CHANGES_REQUESTED);
        return transitionTo(movie, MovieStatus.DRAFT, updatedBy, null);
    }

    /**
     * APPROVED → ARCHIVED: explicit admin catalog decision, not a side effect of
     * ending exhibition anywhere. Blocked while any availability window is still
     * PLANNED or OPEN — those must be closed first (MOV-LC-06), so archive never
     * silently orphans a still-active release plan.
     */
    @Transactional
    public MovieResponse archiveMovie(Long id, String updatedBy) {
        Movie movie = requireStatus(id, MovieStatus.APPROVED);
        boolean hasActiveAvailability = movieAvailabilityRepository.existsByMovie_MovieIdAndStatusIn(
                id, List.of(AvailabilityStatus.PLANNED, AvailabilityStatus.OPEN));
        if (hasActiveAvailability) {
            throw new AppException(MovieErrorCode.MOVIE_HAS_ACTIVE_AVAILABILITY);
        }
        return transitionTo(movie, MovieStatus.ARCHIVED, updatedBy, null);
    }

    /** Persists the transition (through save(), so @Version actually engages) and
     *  its audit trail row in one place — every content-status command goes through here. */
    private MovieResponse transitionTo(Movie movie, MovieStatus to, String actor, String reason) {
        MovieStatus from = movie.getStatus();
        movie.setStatus(to);
        movie.setUpdatedBy(actor);
        Movie saved = movieRepository.save(movie);

        movieStatusHistoryRepository.save(MovieStatusHistory.builder()
                .movieId(saved.getMovieId())
                .fromStatus(from)
                .toStatus(to)
                .actor(actor)
                .reason(reason)
                .build());

        return movieMapper.toMovieResponse(saved);
    }

    // ── Image upload ──────────────────────────────────────────

    public ImageUploadResponse uploadMovieImage(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > MAX_IMAGE_SIZE_BYTES) {
            throw new AppException(MovieErrorCode.INVALID_IMAGE_FILE);
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.matches("image/(jpeg|jpg|png|webp)")) {
            throw new AppException(MovieErrorCode.INVALID_IMAGE_FILE);
        }
        try {
            Map<?, ?> result = imageStorageService.uploadImage(file);
            String secureUrl = result.get("secure_url") != null ? result.get("secure_url").toString() : null;
            String url = result.get("url") != null ? result.get("url").toString() : null;
            String publicId = result.get("public_id") != null ? result.get("public_id").toString() : null;
            return ImageUploadResponse.builder()
                    .url(secureUrl != null ? secureUrl : url)
                    .secureUrl(secureUrl)
                    .publicId(publicId)
                    .build();
        } catch (Exception e) {
            throw new AppException(MovieErrorCode.UPLOAD_IMAGE_FAILED);
        }
    }

    // ── Private helpers ───────────────────────────────────────

    private List<MovieTranslation> saveTranslations(Movie movie, List<TranslationRequest> requests) {
        List<MovieTranslation> result = new java.util.ArrayList<>();
        for (TranslationRequest tr : requests) {
            MovieTranslationId tid = new MovieTranslationId(movie.getMovieId(), tr.getLanguageCode());
            MovieTranslation t = new MovieTranslation();
            t.setId(tid);
            t.setMovie(movie);
            t.setTitle(tr.getTitle());
            t.setSynopsis(tr.getSynopsis());
            t.setTagline(tr.getTagline());
            result.add(movieTranslationRepository.save(t));
        }
        return result;
    }

    private List<MovieCast> saveCast(Movie movie, List<CastRequest> requests) {
        List<MovieCast> result = new java.util.ArrayList<>();
        for (CastRequest cr : requests) {
            Person person = personRepository.findById(cr.getPersonId())
                    .orElseThrow(() -> new AppException(MovieErrorCode.PERSON_NOT_FOUND));
            MovieCast cast = MovieCast.builder()
                    .movie(movie)
                    .person(person)
                    .roleType(cr.getRoleType())
                    .characterName(cr.getCharacterName())
                    .billingOrder(cr.getBillingOrder())
                    .build();
            result.add(movieCastRepository.save(cast));
        }
        return result;
    }

    private Movie requireStatus(Long id, MovieStatus required) {
        Movie movie = movieRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.MOVIE_NOT_FOUND));
        if (movie.getStatus() != required) {
            throw new AppException(MovieErrorCode.INVALID_STATUS_TRANSITION);
        }
        return movie;
    }
}
