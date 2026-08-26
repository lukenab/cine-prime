package movieservice.service;

import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import movieservice.dto.request.MovieScreeningVersionRequest;
import movieservice.dto.response.MovieScreeningVersionCatalogResponse;
import movieservice.dto.response.MovieScreeningVersionResponse;
import movieservice.dto.response.ScreeningVersionCatalogPageResponse;
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
import movieservice.util.MovieTitleResolver;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * Management of concrete movie versions consumed by showtime scheduling.
 * Programming operators prepare versions while the movie is a draft; the
 * existing movie lifecycle still reserves approval and publication for an
 * administrator. Versions are never hard-deleted because showtimes, plans and
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
            List<Long> clusterIds,
            boolean attentionOnly
    ) {
        String normalizedQuery = query == null || query.isBlank() ? null : query.trim();
        return versionRepository.searchCatalog(normalizedQuery, status, formatId).stream()
                .map(version -> toCatalogResponse(version, clusterIds))
                .filter(item -> !attentionOnly || item.requiresAttention())
                .toList();
    }

    @Transactional(readOnly = true)
    public ScreeningVersionCatalogPageResponse searchCatalogPage(
            String query,
            ScreeningVersionStatus status,
            Integer formatId,
            String readiness,
            int page,
            int size
    ) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(size, 1), 100);
        String normalizedQuery = query == null || query.isBlank() ? null : query.trim();
        String normalizedReadiness = switch (readiness == null ? "ALL" : readiness.trim().toUpperCase(Locale.ROOT)) {
            case "READY", "ATTENTION", "INACTIVE" -> readiness.trim().toUpperCase(Locale.ROOT);
            default -> "ALL";
        };

        Page<Long> moviePage = versionRepository.findCatalogMovieIds(
                normalizedQuery,
                status == null ? null : status.name(),
                formatId,
                normalizedReadiness,
                PageRequest.of(safePage, safeSize));

        Map<Long, ScreeningVersionCatalogPageResponse.MovieGroup> groups = new LinkedHashMap<>();
        moviePage.getContent().forEach(movieId -> groups.put(movieId, null));
        if (!moviePage.isEmpty()) {
            Map<Long, List<MovieScreeningVersionCatalogResponse>> versionsByMovie =
                    versionRepository.findCatalogByMovieIds(moviePage.getContent()).stream()
                            .map(version -> toCatalogResponse(version, List.of()))
                            .filter(item -> matchesCatalogFilters(
                                    item, normalizedQuery, status, formatId, normalizedReadiness))
                            .collect(java.util.stream.Collectors.groupingBy(
                                    MovieScreeningVersionCatalogResponse::movieId,
                                    LinkedHashMap::new,
                                    java.util.stream.Collectors.toList()));

            moviePage.getContent().forEach(movieId -> {
                List<MovieScreeningVersionCatalogResponse> versions = versionsByMovie.getOrDefault(movieId, List.of());
                if (versions.isEmpty()) return;
                MovieScreeningVersionCatalogResponse first = versions.get(0);
                groups.put(movieId, new ScreeningVersionCatalogPageResponse.MovieGroup(
                        movieId,
                        first.movieTitle(),
                        first.originalTitle(),
                        first.posterUrl(),
                        first.movieStatus(),
                        versions));
            });
        }

        ScreeningVersionCatalogPageResponse.Summary summary =
                new ScreeningVersionCatalogPageResponse.Summary(
                        versionRepository.countCatalogMovies(),
                        versionRepository.countCatalogVersions(),
                        versionRepository.countSchedulableVersions(),
                        versionRepository.countAttentionVersions());

        return new ScreeningVersionCatalogPageResponse(
                groups.values().stream().filter(Objects::nonNull).toList(),
                moviePage.getNumber(),
                moviePage.getSize(),
                moviePage.getTotalElements(),
                moviePage.getTotalPages(),
                summary);
    }

    private boolean matchesCatalogFilters(
            MovieScreeningVersionCatalogResponse item,
            String query,
            ScreeningVersionStatus status,
            Integer formatId,
            String readiness
    ) {
        if (status != null && item.status() != status) return false;
        if (formatId != null && !item.formatId().equals(formatId)) return false;

        boolean readinessMatches = switch (readiness) {
            case "READY" -> item.status() == ScreeningVersionStatus.ACTIVE && !item.requiresAttention();
            case "ATTENTION" -> item.status() == ScreeningVersionStatus.ACTIVE && item.requiresAttention();
            case "INACTIVE" -> item.status() != ScreeningVersionStatus.ACTIVE;
            default -> true;
        };
        if (!readinessMatches) return false;
        if (query == null) return true;

        String needle = query.toLowerCase(Locale.ROOT);
        return containsIgnoreCase(item.movieTitle(), needle)
                || containsIgnoreCase(item.originalTitle(), needle)
                || containsIgnoreCase(item.formatCode(), needle)
                || containsIgnoreCase(item.audioFormatCode(), needle)
                || containsIgnoreCase(item.audioLanguageCode(), needle)
                || containsIgnoreCase(item.subtitleLanguageCode(), needle);
    }

    private boolean containsIgnoreCase(String value, String normalizedNeedle) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(normalizedNeedle);
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

    private MovieScreeningVersionCatalogResponse toCatalogResponse(
            MovieScreeningVersion version,
            List<Long> clusterIds
    ) {
        MovieScreeningVersionResponse detail = toResponse(version);
        Movie movie = version.getMovie();
        List<Long> scope = clusterIds == null ? List.of() : clusterIds.stream().distinct().toList();
        long compatibleRooms = scope.isEmpty()
                ? detail.compatibleRoomCount()
                : detail.audioFormatId() == null
                    ? versionRepository.countCompatibleRoomsInClusters(detail.formatId(), scope)
                    : versionRepository.countAudioCompatibleRoomsInClusters(detail.formatId(), detail.audioFormatId(), scope);
        long compatibleClusters = scope.isEmpty()
                ? detail.compatibleClusterCount()
                : detail.audioFormatId() == null
                    ? versionRepository.countCompatibleClustersInScope(detail.formatId(), scope)
                    : versionRepository.countAudioCompatibleClustersInScope(detail.formatId(), detail.audioFormatId(), scope);
        boolean requiresAttention = detail.status() == ScreeningVersionStatus.ACTIVE
                && (detail.audioFormatId() == null || compatibleRooms == 0);
        return new MovieScreeningVersionCatalogResponse(
                detail.screeningVersionId(),
                detail.movieId(),
                MovieTitleResolver.preferredVietnameseTitle(movie),
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
                compatibleRooms,
                compatibleClusters,
                detail.referenceCount(),
                detail.referenced(),
                requiresAttention,
                detail.createdAt(),
                detail.updatedAt()
        );
    }
}
