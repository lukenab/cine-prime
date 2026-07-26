package movieservice.dto.response;

import movieservice.enums.ScreeningVersionStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record MovieScreeningVersionResponse(
        Long screeningVersionId,
        Long movieId,
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
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
