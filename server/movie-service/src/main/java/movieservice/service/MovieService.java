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
import movieservice.entity.*;
import movieservice.enums.MovieStatus;
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

import java.time.LocalDate;
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
    ScreeningFormatRepository screeningFormatRepository;
    ProductionCompanyRepository productionCompanyRepository;
    PersonRepository personRepository;
    MovieCastRepository movieCastRepository;
    MovieTranslationRepository movieTranslationRepository;
    CinemaRoomService cinemaRoomService;
    ShowTimeService showTimeService;
    AuditLogService auditLogService;
    ImageStorageService imageStorageService;

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
        if (request.getCompanyId() != null) {
            ProductionCompany company = productionCompanyRepository.findById(request.getCompanyId())
                    .orElseThrow(() -> new AppException(MovieErrorCode.COMPANY_NOT_FOUND));
            movie.setCompany(company);
        }

        // Genres
        List<Genre> genres = genreRepository.findAllByGenreIdIn(request.getGenreIds());
        if (genres.size() != request.getGenreIds().size()) {
            throw new AppException(MovieErrorCode.GENRE_NOT_FOUND);
        }
        movie.setGenres(genres);

        // Screening formats
        List<ScreeningFormat> formats = screeningFormatRepository.findAllByFormatIdIn(request.getFormatIds());
        if (formats.size() != request.getFormatIds().size()) {
            throw new AppException(MovieErrorCode.FORMAT_NOT_FOUND);
        }
        movie.setFormats(formats);

        Movie saved = movieRepository.save(movie);

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

        return movieMapper.toMovieResponse(saved);
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
        return movieMapper.toMovieResponse(movie);
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
        if (lang != null && !lang.isBlank() && response.getTranslations() != null) {
            response.setTranslations(
                    response.getTranslations().stream()
                            .filter(t -> lang.equalsIgnoreCase(t.getLanguageCode()))
                            .collect(Collectors.toList())
            );
        }
        return response;
    }

    @Transactional
    public List<MovieResponse> findAllPublic() {
        // Public: only visible statuses
        List<Movie> movies = movieRepository.findByStatusIn(
                List.of(MovieStatus.COMING_SOON, MovieStatus.NOW_SHOWING));
        return movieMapper.toMovieResponseList(movies);
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

    /** GET /api/movies?status=NOW_SHOWING&genreId=1&date=2026-07-09 */
    @Transactional
    public Page<MovieResponse> findPageWithFilters(
            int page, int size,
            MovieStatus status, Long genreId, LocalDate releaseDate) {
        Pageable pageable = PageRequest.of(page, size);
        return movieRepository.findWithFilters(status, genreId, releaseDate, pageable)
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

        // 1) Scalar fields - null-safe qua @BeanMapping(IGNORE) tren mapper.
        movieMapper.updateMovieFromRequest(request, movie);

        // 2) FK don le - null nghia la khong doi (giu nguyen quan he hien tai).
        if (request.getAgeRatingId() != null) {
            movie.setAgeRating(ageRatingRepository.findById(request.getAgeRatingId())
                    .orElseThrow(() -> new AppException(MovieErrorCode.AGE_RATING_NOT_FOUND)));
        }
        if (request.getCompanyId() != null) {
            movie.setCompany(productionCompanyRepository.findById(request.getCompanyId())
                    .orElseThrow(() -> new AppException(MovieErrorCode.COMPANY_NOT_FOUND)));
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
        if (request.getFormatIds() != null) {
            List<Integer> distinctFormatIds = request.getFormatIds().stream().distinct().collect(Collectors.toList());
            List<ScreeningFormat> formats = screeningFormatRepository.findAllByFormatIdIn(distinctFormatIds);
            if (formats.size() != distinctFormatIds.size()) {
                throw new AppException(MovieErrorCode.FORMAT_NOT_FOUND);
            }
            movie.setFormats(formats);
        }

        // 4) Translations / cast - reconcile thay vi delete-all-then-insert.
        if (request.getTranslations() != null) {
            reconcileTranslations(movie, request.getTranslations());
        }
        if (request.getCast() != null) {
            reconcileCast(movie, request.getCast());
        }

        return movieMapper.toMovieResponse(movieRepository.save(movie));
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
            movie.setTranslations(new ArrayList<>());
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
            } else {
                translation = new MovieTranslation();
                translation.setId(new MovieTranslationId(movie.getMovieId(), lang));
                translation.setMovie(movie);
                translation.setTitle(tr.getTitle());
                translation.setSynopsis(tr.getSynopsis());
            }
            result.add(movieTranslationRepository.save(translation));
        }

        List<MovieTranslation> toRemove = existing.stream()
                .filter(t -> !byLang.containsKey(t.getId().getLanguageCode().toLowerCase()))
                .collect(Collectors.toList());
        if (!toRemove.isEmpty()) movieTranslationRepository.deleteAll(toRemove);

        movie.setTranslations(result);
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
            movie.setCast(new ArrayList<>());
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

        movie.setCast(result);
    }

    // ── Status transitions ────────────────────────────────────

    @Transactional
    public void submitForReview(Long id, String updatedBy) {
        requireStatus(id, MovieStatus.DRAFT);
        movieRepository.updateStatus(id, MovieStatus.PENDING_REVIEW, updatedBy);
    }

    @Transactional
    public void approveMovie(Long id, String updatedBy) {
        requireStatus(id, MovieStatus.PENDING_REVIEW);
        movieRepository.updateStatus(id, MovieStatus.COMING_SOON, updatedBy);
    }

    @Transactional
    public void rejectMovie(Long id, String note, String updatedBy) {
        requireStatus(id, MovieStatus.PENDING_REVIEW);
        movieRepository.rejectMovie(id, note, updatedBy);
    }

    @Transactional
    public void suspendMovie(Long id, String reason, String updatedBy) {
        Movie movie = movieRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.MOVIE_NOT_FOUND));
        if (movie.getStatus() != MovieStatus.NOW_SHOWING && movie.getStatus() != MovieStatus.COMING_SOON) {
            throw new AppException(MovieErrorCode.INVALID_STATUS_TRANSITION);
        }
        movieRepository.suspendMovie(id, reason, updatedBy);
    }

    @Transactional
    public void endMovie(Long id, String updatedBy) {
        Movie movie = movieRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.MOVIE_NOT_FOUND));
        if (movie.getStatus() == MovieStatus.DRAFT || movie.getStatus() == MovieStatus.PENDING_REVIEW
                || movie.getStatus() == MovieStatus.REJECTED) {
            throw new AppException(MovieErrorCode.INVALID_STATUS_TRANSITION);
        }
        movieRepository.updateStatus(id, MovieStatus.ENDED, updatedBy);
    }

    /** REJECTED → DRAFT: employee chỉnh sửa lại sau khi bị từ chối */
    @Transactional
    public void reworkMovie(Long id, String updatedBy) {
        requireStatus(id, MovieStatus.REJECTED);
        movieRepository.updateStatus(id, MovieStatus.DRAFT, updatedBy);
    }

    /** COMING_SOON → NOW_SHOWING: admin mở bán vé khi phim bắt đầu chiếu */
    @Transactional
    public void releaseMovie(Long id, String updatedBy) {
        requireStatus(id, MovieStatus.COMING_SOON);
        movieRepository.updateStatus(id, MovieStatus.NOW_SHOWING, updatedBy);
    }

    /** SUSPENDED → NOW_SHOWING: admin phục hồi phim sau khi xử lý sự cố */
    @Transactional
    public void reinstateMovie(Long id, String updatedBy) {
        requireStatus(id, MovieStatus.SUSPENDED);
        movieRepository.updateStatus(id, MovieStatus.NOW_SHOWING, updatedBy);
    }

    // ── Delete (soft via SUSPENDED/ENDED) ────────────────────

    @Transactional
    public void deleteMovie(Long id) {
        Movie movie = movieRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.MOVIE_NOT_FOUND));

        boolean hasFutureShowTimes = showTimeService.existsMovie(
                movie.getMovieId(), LocalDate.now(), LocalTime.now());
        if (hasFutureShowTimes) {
            throw new AppException(MovieErrorCode.ACTIVE_SHOWTIMES_EXIST);
        }

        movieRepository.updateStatus(id, MovieStatus.ENDED, "SYSTEM");
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

    private void requireStatus(Long id, MovieStatus required) {
        Movie movie = movieRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.MOVIE_NOT_FOUND));
        if (movie.getStatus() != required) {
            throw new AppException(MovieErrorCode.INVALID_STATUS_TRANSITION);
        }
    }
}
