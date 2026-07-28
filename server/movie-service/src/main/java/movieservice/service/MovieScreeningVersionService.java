package movieservice.service;

import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import movieservice.dto.request.MovieScreeningVersionRequest;
import movieservice.dto.response.MovieScreeningVersionCatalogResponse;
import movieservice.dto.response.MovieScreeningVersionResponse;
import movieservice.entity.AudioFormat;
import movieservice.entity.Movie;
import movieservice.entity.MovieScreeningVersion;
import movieservice.entity.ScreeningFormat;
import movieservice.enums.MovieStatus;
import movieservice.enums.ScreeningVersionStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.AudioFormatRepository;
import movieservice.repository.MovieRepository;
import movieservice.repository.MovieScreeningVersionRepository;
import movieservice.repository.ScreeningFormatRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * Admin management for concrete movie versions consumed by showtime
 * scheduling. Versions are never hard-deleted because showtimes, plans and
 * theatrical rights may retain their IDs for audit/history.
 */
@Service
@RequiredArgsConstructor
public class MovieScreeningVersionService {

    private final MovieRepository movieRepository;
    private final ScreeningFormatRepository screeningFormatRepository;
    private final AudioFormatRepository audioFormatRepository;
    private final MovieScreeningVersionRepository versionRepository;

    @Transactional(readOnly = true)
    public List<MovieScreeningVersionResponse> list(Long movieId) {
        loadMovie(movieId);
        return versionRepository.findByMovieIdWithFormat(movieId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MovieScreeningVersionCatalogResponse> searchCatalog(
            String query,
            ScreeningVersionStatus status,
            Integer formatId,
            boolean attentionOnly
    ) {
        String normalizedQuery = query == null || query.isBlank() ? null : query.trim();
        return versionRepository.searchCatalog(normalizedQuery, status, formatId).stream()
                .map(this::toCatalogResponse)
                .filter(item -> !attentionOnly || item.requiresAttention())
                .toList();
    }

    @Transactional
    public MovieScreeningVersionResponse create(Long movieId, MovieScreeningVersionRequest request) {
        Movie movie = loadEditableMovie(movieId);
        ScreeningFormat format = resolvePresentationFormat(request.formatId());
        AudioFormat audioFormat = resolveAudioFormat(request.audioFormatId());
        validateDateWindow(request);

        String audio = normalizeRequiredLanguage(request.audioLanguageCode());
        String subtitle = normalizeOptionalLanguage(request.subtitleLanguageCode());
        ensureUniqueBusinessKey(
                movieId, format.getFormatId(), audioFormat.getAudioFormatId(), audio, subtitle, null);

        MovieScreeningVersion version = MovieScreeningVersion.builder()
                .movie(movie)
                .format(format)
                .audioFormat(audioFormat)
                .audioLanguageCode(audio)
                .subtitleLanguageCode(subtitle)
                .effectiveFrom(request.effectiveFrom())
                .effectiveTo(request.effectiveTo())
                .status(ScreeningVersionStatus.ACTIVE)
                .build();
        MovieScreeningVersion saved = saveWithDuplicateGuard(version);
        ensureMovieFormatProjection(movie, format);
        return toResponse(saved);
    }

    /**
     * Creates a reviewed set of delivery versions as one unit. This is used by
     * the editor's recommended-setup action so operators do not need to submit
     * the same language/audio metadata once per presentation format.
     *
     * <p>The transaction is intentionally owned by this method: if one
     * combination is invalid or duplicated, none of the requested versions is
     * retained.</p>
     */
    @Transactional
    public List<MovieScreeningVersionResponse> createBulk(
            Long movieId,
            List<MovieScreeningVersionRequest> requests
    ) {
        return requests.stream()
                .map(request -> create(movieId, request))
                .toList();
    }

    @Transactional
    public MovieScreeningVersionResponse update(
            Long movieId,
            Long versionId,
            MovieScreeningVersionRequest request
    ) {
        Movie movie = loadEditableMovie(movieId);
        MovieScreeningVersion version = loadVersion(movieId, versionId);
        ScreeningFormat format = resolvePresentationFormat(request.formatId());
        AudioFormat audioFormat = resolveAudioFormat(request.audioFormatId());
        validateDateWindow(request);

        String audio = normalizeRequiredLanguage(request.audioLanguageCode());
        String subtitle = normalizeOptionalLanguage(request.subtitleLanguageCode());
        ensureUniqueBusinessKey(
                movieId, format.getFormatId(), audioFormat.getAudioFormatId(), audio, subtitle, versionId);

        if (referenceCount(versionId) > 0
                && (!Objects.equals(version.getFormat().getFormatId(), format.getFormatId())
                || !Objects.equals(
                        version.getAudioFormat() == null ? null : version.getAudioFormat().getAudioFormatId(),
                        audioFormat.getAudioFormatId())
                || !Objects.equals(version.getAudioLanguageCode(), audio)
                || !Objects.equals(version.getSubtitleLanguageCode(), subtitle)
                || !Objects.equals(version.getEffectiveFrom(), request.effectiveFrom())
                || !Objects.equals(version.getEffectiveTo(), request.effectiveTo()))) {
            throw new AppException(MovieErrorCode.SCREENING_VERSION_REFERENCED_IMMUTABLE);
        }

        version.setFormat(format);
        version.setAudioFormat(audioFormat);
        version.setAudioLanguageCode(audio);
        version.setSubtitleLanguageCode(subtitle);
        version.setEffectiveFrom(request.effectiveFrom());
        version.setEffectiveTo(request.effectiveTo());
        MovieScreeningVersion saved = saveWithDuplicateGuard(version);
        ensureMovieFormatProjection(movie, format);
        return toResponse(saved);
    }

    @Transactional
    public MovieScreeningVersionResponse activate(Long movieId, Long versionId) {
        Movie movie = loadEditableMovie(movieId);
        MovieScreeningVersion version = loadVersion(movieId, versionId);
        if (version.getStatus() == ScreeningVersionStatus.SUPERSEDED) {
            throw new AppException(MovieErrorCode.INVALID_STATUS_TRANSITION);
        }
        resolvePresentationFormat(version.getFormat().getFormatId());
        if (version.getAudioFormat() == null) {
            throw new AppException(MovieErrorCode.AUDIO_FORMAT_NOT_FOUND);
        }
        resolveAudioFormat(version.getAudioFormat().getAudioFormatId());
        version.setStatus(ScreeningVersionStatus.ACTIVE);
        return toResponse(versionRepository.save(version));
    }

    @Transactional
    public MovieScreeningVersionResponse deactivate(Long movieId, Long versionId) {
        loadMovie(movieId);
        MovieScreeningVersion version = loadVersion(movieId, versionId);
        version.setStatus(ScreeningVersionStatus.INACTIVE);
        return toResponse(versionRepository.save(version));
    }

    private Movie loadMovie(Long movieId) {
        return movieRepository.findById(movieId)
                .orElseThrow(() -> new AppException(MovieErrorCode.MOVIE_NOT_FOUND));
    }

    private Movie loadEditableMovie(Long movieId) {
        Movie movie = loadMovie(movieId);
        if (movie.getStatus() != MovieStatus.DRAFT) {
            throw new AppException(MovieErrorCode.MOVIE_NOT_EDITABLE);
        }
        return movie;
    }

    private MovieScreeningVersion loadVersion(Long movieId, Long versionId) {
        return versionRepository.findByScreeningVersionIdAndMovie_MovieId(versionId, movieId)
                .orElseThrow(() -> new AppException(MovieErrorCode.SCREENING_VERSION_NOT_FOUND));
    }

    private ScreeningFormat resolvePresentationFormat(Integer formatId) {
        ScreeningFormat format = screeningFormatRepository.findById(formatId)
                .orElseThrow(() -> new AppException(MovieErrorCode.FORMAT_NOT_FOUND));
        if (!"ACTIVE".equalsIgnoreCase(format.getStatus())
                || "ATMOS".equalsIgnoreCase(format.getFormatCode())) {
            throw new AppException(MovieErrorCode.FORMAT_NOT_FOUND);
        }
        return format;
    }

    private AudioFormat resolveAudioFormat(Integer audioFormatId) {
        return audioFormatRepository.findByAudioFormatIdAndActiveTrue(audioFormatId)
                .orElseThrow(() -> new AppException(MovieErrorCode.AUDIO_FORMAT_NOT_FOUND));
    }

    private void validateDateWindow(MovieScreeningVersionRequest request) {
        if (request.effectiveFrom() != null
                && request.effectiveTo() != null
                && request.effectiveTo().isBefore(request.effectiveFrom())) {
            throw new AppException(MovieErrorCode.SCREENING_VERSION_DATE_RANGE_INVALID);
        }
    }

    private void ensureUniqueBusinessKey(
            Long movieId,
            Integer formatId,
            Integer audioFormatId,
            String audio,
            String subtitle,
            Long excludedVersionId
    ) {
        boolean duplicate = versionRepository.findByMovie_MovieId(movieId).stream()
                .anyMatch(version -> !Objects.equals(version.getScreeningVersionId(), excludedVersionId)
                        && Objects.equals(version.getFormat().getFormatId(), formatId)
                        && Objects.equals(
                                version.getAudioFormat() == null
                                        ? null
                                        : version.getAudioFormat().getAudioFormatId(),
                                audioFormatId)
                        && Objects.equals(normalizeRequiredLanguage(version.getAudioLanguageCode()), audio)
                        && Objects.equals(normalizeOptionalLanguage(version.getSubtitleLanguageCode()), subtitle));
        if (duplicate) {
            throw new AppException(MovieErrorCode.SCREENING_VERSION_DUPLICATE);
        }
    }

    private MovieScreeningVersion saveWithDuplicateGuard(MovieScreeningVersion version) {
        try {
            return versionRepository.saveAndFlush(version);
        } catch (DataIntegrityViolationException exception) {
            throw new AppException(MovieErrorCode.SCREENING_VERSION_DUPLICATE);
        }
    }

    private String normalizeRequiredLanguage(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeOptionalLanguage(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim().toLowerCase(Locale.ROOT);
    }

    private long referenceCount(Long versionId) {
        return versionRepository.countShowtimeReferences(versionId)
                + versionRepository.countSchedulePlanReferences(versionId);
    }

    private void ensureMovieFormatProjection(Movie movie, ScreeningFormat format) {
        List<ScreeningFormat> formats = movie.getFormats();
        if (formats != null && formats.stream()
                .anyMatch(item -> Objects.equals(item.getFormatId(), format.getFormatId()))) {
            return;
        }
        java.util.ArrayList<ScreeningFormat> updated =
                new java.util.ArrayList<>(formats == null ? List.of() : formats);
        updated.add(format);
        movie.setFormats(updated);
        movieRepository.save(movie);
    }

    private MovieScreeningVersionResponse toResponse(MovieScreeningVersion version) {
        Integer formatId = version.getFormat().getFormatId();
        AudioFormat audioFormat = version.getAudioFormat();
        Integer audioFormatId = audioFormat == null ? null : audioFormat.getAudioFormatId();
        long references = referenceCount(version.getScreeningVersionId());
        long compatibleRooms = audioFormatId == null
                ? versionRepository.countCompatibleRooms(formatId)
                : versionRepository.countAudioCompatibleRooms(formatId, audioFormatId);
        long compatibleClusters = audioFormatId == null
                ? versionRepository.countCompatibleClusters(formatId)
                : versionRepository.countAudioCompatibleClusters(formatId, audioFormatId);
        return new MovieScreeningVersionResponse(
                version.getScreeningVersionId(),
                version.getMovie().getMovieId(),
                formatId,
                version.getFormat().getFormatCode(),
                version.getFormat().getFormatName(),
                audioFormatId,
                audioFormat == null ? null : audioFormat.getFormatCode(),
                audioFormat == null ? null : audioFormat.getFormatName(),
                version.getAudioLanguageCode(),
                version.getSubtitleLanguageCode(),
                version.getStatus(),
                version.getEffectiveFrom(),
                version.getEffectiveTo(),
                compatibleRooms,
                compatibleClusters,
                references,
                references > 0,
                version.getCreatedAt(),
                version.getUpdatedAt()
        );
    }

    private MovieScreeningVersionCatalogResponse toCatalogResponse(MovieScreeningVersion version) {
        MovieScreeningVersionResponse detail = toResponse(version);
        Movie movie = version.getMovie();
        boolean requiresAttention = detail.status() == ScreeningVersionStatus.ACTIVE
                && (detail.audioFormatId() == null || detail.compatibleRoomCount() == 0);
        return new MovieScreeningVersionCatalogResponse(
                detail.screeningVersionId(),
                detail.movieId(),
                movie.getOriginalTitle(),
                movie.getPosterUrl(),
                movie.getStatus(),
                detail.formatId(),
                detail.formatCode(),
                detail.formatName(),
                detail.audioFormatId(),
                detail.audioFormatCode(),
                detail.audioFormatName(),
                detail.audioLanguageCode(),
                detail.subtitleLanguageCode(),
                detail.status(),
                detail.effectiveFrom(),
                detail.effectiveTo(),
                detail.compatibleRoomCount(),
                detail.compatibleClusterCount(),
                detail.referenceCount(),
                detail.referenced(),
                requiresAttention,
                detail.createdAt(),
                detail.updatedAt()
        );
    }
}
