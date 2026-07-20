package movieservice.service;

import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import movieservice.dto.request.MovieImageRequest;
import movieservice.dto.request.TmdbImageImportRequest;
import movieservice.dto.response.MovieImageResponse;
import movieservice.dto.response.TmdbImageImportResponse;
import movieservice.dto.tmdb.TmdbConfigurationResponse;
import movieservice.dto.tmdb.TmdbImagesResponse;
import movieservice.entity.Movie;
import movieservice.entity.MovieImage;
import movieservice.enums.MovieImageType;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.MovieImageRepository;
import movieservice.repository.MovieRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * TMDB-FIX-05: selective import of TMDB posters/backdrops/stills into movie_image, with
 * dedup by (movie_id, source, external_path) so re-import never creates duplicates. Manual
 * (non-TMDB) image CRUD lives here too - moved out of MovieImageController so the import
 * logic and the plain CRUD share one place for movie/ownership checks.
 */
@Service
@RequiredArgsConstructor
public class MovieImageService {

    private static final String SOURCE_TMDB = "TMDB";
    private static final String SOURCE_MANUAL = "MANUAL";

    private final MovieRepository movieRepository;
    private final MovieImageRepository movieImageRepository;
    private final TmdbService tmdbService;
    private final MovieMapper movieMapper;

    public List<MovieImageResponse> getImages(Long movieId) {
        requireMovie(movieId);
        return movieMapper.toMovieImageResponseList(
                movieImageRepository.findByMovie_MovieIdOrderByDisplayOrderAscImageIdAsc(movieId));
    }

    public MovieImageResponse addImage(Long movieId, MovieImageRequest request) {
        Movie movie = requireMovie(movieId);
        MovieImage image = MovieImage.builder()
                .movie(movie)
                .imageUrl(request.getImageUrl())
                .imageType(request.getImageType() != null ? request.getImageType() : MovieImageType.STILL)
                .displayOrder(request.getDisplayOrder())
                .caption(request.getCaption())
                .source(SOURCE_MANUAL)
                .build();
        image = movieImageRepository.save(image);
        return movieMapper.toMovieImageResponse(image);
    }

    public void deleteImage(Long movieId, Long imageId) {
        requireMovie(movieId);
        MovieImage image = movieImageRepository.findById(imageId)
                .orElseThrow(() -> new AppException(MovieErrorCode.MOVIE_IMAGE_NOT_FOUND));
        if (!image.getMovie().getMovieId().equals(movieId)) {
            throw new AppException(MovieErrorCode.MOVIE_IMAGE_NOT_FOUND);
        }
        movieImageRepository.delete(image);
    }

    /**
     * Persists admin-selected TMDB candidates (from GET /tmdb/{tmdbId}/details .media). Re-fetches
     * TMDB images to (a) confirm each selected filePath is still offered by TMDB and (b) capture
     * width/height/aspect ratio/language for storage - the selection request itself only carries
     * filePath + imageType, not the full metadata, so this is not optional.
     */
    @Transactional
    public TmdbImageImportResponse importFromTmdb(Long movieId, TmdbImageImportRequest request) {
        Movie movie = requireMovie(movieId);
        enforcePerTypeLimits(request);

        TmdbImagesResponse images = tmdbService.fetchImages(request.getTmdbId());
        Map<String, TmdbImagesResponse.TmdbImageItem> candidatesByPath = new HashMap<>();
        if (images.getPosters() != null) images.getPosters().forEach(i -> candidatesByPath.put(i.getFilePath(), i));
        if (images.getBackdrops() != null) images.getBackdrops().forEach(i -> candidatesByPath.put(i.getFilePath(), i));

        Set<String> existingKeys = movieImageRepository.findExistingSourcePathKeys(movieId);
        TmdbConfigurationResponse config = tmdbService.getImageConfig();

        List<MovieImage> toSave = new ArrayList<>();
        int skippedDuplicates = 0;

        for (TmdbImageImportRequest.Selection selection : request.getSelections()) {
            TmdbImagesResponse.TmdbImageItem item = candidatesByPath.get(selection.getFilePath());
            if (item == null) {
                throw new AppException(MovieErrorCode.TMDB_IMAGE_NOT_FOUND);
            }
            if (existingKeys.contains(SOURCE_TMDB + ":" + selection.getFilePath())) {
                skippedDuplicates++;
                continue;
            }
            toSave.add(MovieImage.builder()
                    .movie(movie)
                    .imageUrl(tmdbService.resolveImageUrl(config, selection.getFilePath(), selection.getImageType()))
                    .imageType(selection.getImageType())
                    .displayOrder(selection.getDisplayOrder())
                    .source(SOURCE_TMDB)
                    .externalPath(selection.getFilePath())
                    .languageCode(item.getIso6391())
                    .width(item.getWidth())
                    .height(item.getHeight())
                    .aspectRatio(item.getAspectRatio() != null ? BigDecimal.valueOf(item.getAspectRatio()) : null)
                    .isDefault(true)
                    .build());
        }

        List<MovieImage> saved;
        try {
            saved = movieImageRepository.saveAll(toSave);
        } catch (DataIntegrityViolationException e) {
            // Closes the race window between findExistingSourcePathKeys() and this insert
            // (two concurrent imports of the same asset).
            throw new AppException(MovieErrorCode.TMDB_IMAGE_ALREADY_IMPORTED);
        }

        List<String> warnings = new ArrayList<>();
        if (skippedDuplicates > 0) {
            warnings.add("DUPLICATE_IMAGES_SKIPPED:" + skippedDuplicates);
        }

        return TmdbImageImportResponse.builder()
                .importedCount(saved.size())
                .skippedDuplicateCount(skippedDuplicates)
                .images(movieMapper.toMovieImageResponseList(saved))
                .warnings(warnings)
                .build();
    }

    /** AC: at most 1 poster + 1 backdrop per import; stills capped at the configured maximum. */
    private void enforcePerTypeLimits(TmdbImageImportRequest request) {
        long posterCount = countType(request, MovieImageType.POSTER);
        long backdropCount = countType(request, MovieImageType.BACKDROP);
        long stillCount = countType(request, MovieImageType.STILL);
        if (posterCount > 1 || backdropCount > 1 || stillCount > tmdbService.getMaxStills()) {
            throw new AppException(MovieErrorCode.MOVIE_IMAGE_TYPE_LIMIT_EXCEEDED);
        }
    }

    private long countType(TmdbImageImportRequest request, MovieImageType type) {
        return request.getSelections().stream().filter(s -> s.getImageType() == type).count();
    }

    private Movie requireMovie(Long movieId) {
        return movieRepository.findById(movieId)
                .orElseThrow(() -> new AppException(MovieErrorCode.MOVIE_NOT_FOUND));
    }
}
