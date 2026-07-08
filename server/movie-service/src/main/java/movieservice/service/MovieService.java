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
import java.util.List;

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

        // Translations
        if (request.getTranslations() != null) {
            saveTranslations(saved, request.getTranslations());
        }

        // Cast
        if (request.getCast() != null) {
            saveCast(saved, request.getCast());
        }

        auditLogService.logAction("SYSTEM", "Admin", "movie:" + saved.getMovieId(),
                "Created movie: " + saved.getOriginalTitle());

        return movieMapper.toMovieResponse(movieRepository.findById(saved.getMovieId()).orElseThrow());
    }

    // ── Read ──────────────────────────────────────────────────

    public MovieResponse getMovie(Long id) {
        Movie movie = movieRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.MOVIE_NOT_FOUND));
        return movieMapper.toMovieResponse(movie);
    }

    public List<MovieResponse> findAllPublic() {
        // Public: only visible statuses
        List<Movie> movies = movieRepository.findByStatusIn(
                List.of(MovieStatus.COMING_SOON, MovieStatus.NOW_SHOWING));
        return movieMapper.toMovieResponseList(movies);
    }

    public List<MovieResponse> findAll() {
        // Admin: all movies regardless of status
        return movieMapper.toMovieResponseList(movieRepository.findAll());
    }

    public Page<MovieResponse> findPage(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return movieRepository.findAll(pageable).map(movieMapper::toMovieResponse);
    }

    // ── Update ────────────────────────────────────────────────

    @Transactional
    public MovieResponse updateMovie(Long id, UpdateMovieRequest request) {
        Movie movie = movieRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.MOVIE_NOT_FOUND));

        movieMapper.updateMovieFromRequest(request, movie);

        if (request.getAgeRatingId() != null) {
            movie.setAgeRating(ageRatingRepository.findById(request.getAgeRatingId())
                    .orElseThrow(() -> new AppException(MovieErrorCode.AGE_RATING_NOT_FOUND)));
        }
        if (request.getCompanyId() != null) {
            movie.setCompany(productionCompanyRepository.findById(request.getCompanyId())
                    .orElseThrow(() -> new AppException(MovieErrorCode.COMPANY_NOT_FOUND)));
        }
        if (request.getGenreIds() != null) {
            List<Genre> genres = genreRepository.findAllByGenreIdIn(request.getGenreIds());
            if (genres.size() != request.getGenreIds().size()) {
                throw new AppException(MovieErrorCode.GENRE_NOT_FOUND);
            }
            movie.setGenres(genres);
        }
        if (request.getFormatIds() != null) {
            List<ScreeningFormat> formats = screeningFormatRepository.findAllByFormatIdIn(request.getFormatIds());
            if (formats.size() != request.getFormatIds().size()) {
                throw new AppException(MovieErrorCode.FORMAT_NOT_FOUND);
            }
            movie.setFormats(formats);
        }
        if (request.getTranslations() != null) {
            movieTranslationRepository.deleteById_MovieId(id);
            saveTranslations(movie, request.getTranslations());
        }
        if (request.getCast() != null) {
            movieCastRepository.deleteByMovie_MovieId(id);
            saveCast(movie, request.getCast());
        }

        return movieMapper.toMovieResponse(movieRepository.save(movie));
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
        movieRepository.updateStatus(id, MovieStatus.ENDED, updatedBy);
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

    private void saveTranslations(Movie movie, List<TranslationRequest> requests) {
        for (TranslationRequest tr : requests) {
            MovieTranslationId tid = new MovieTranslationId(movie.getMovieId(), tr.getLanguageCode());
            MovieTranslation t = new MovieTranslation();
            t.setId(tid);
            t.setMovie(movie);
            t.setTitle(tr.getTitle());
            t.setSynopsis(tr.getSynopsis());
            movieTranslationRepository.save(t);
        }
    }

    private void saveCast(Movie movie, List<CastRequest> requests) {
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
            movieCastRepository.save(cast);
        }
    }

    private void requireStatus(Long id, MovieStatus required) {
        Movie movie = movieRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.MOVIE_NOT_FOUND));
        if (movie.getStatus() != required) {
            throw new AppException(MovieErrorCode.INVALID_STATUS_TRANSITION);
        }
    }
}
