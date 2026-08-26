package movieservice.dto.response;

import movieservice.enums.MovieStatus;
import movieservice.enums.ScreeningVersionStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Flat operational projection used by the cross-movie screening-version
 * catalogue. Movie Editor continues to use {@link MovieScreeningVersionResponse}
 * for commands scoped to one movie.
 */
public record MovieScreeningVersionCatalogResponse(
        Long screeningVersionId,
        Long movieId,
        String movieTitle,
        String originalTitle,
        String posterUrl,
        MovieStatus movieStatus,
        Integer formatId,
        String formatCode,
        String formatName,
        Integer audioFormatId,
        String audioFormatCode,
        String audioFormatName,
        String audioLanguageCode,
        String subtitleLanguageCode,
        ScreeningVersionStatus status,
        LocalDate effectiveFrom,
        LocalDate effectiveTo,
        long compatibleRoomCount,
        long compatibleClusterCount,
        long referenceCount,
        boolean referenced,
        boolean requiresAttention,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
