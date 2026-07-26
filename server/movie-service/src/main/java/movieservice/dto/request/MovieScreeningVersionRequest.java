package movieservice.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * Content-editor command for one concrete exhibition version of a movie, for
 * example 2D Vietnamese audio or IMAX English audio with Vietnamese subtitles.
 * Status is deliberately excluded: activation/deactivation are explicit
 * lifecycle commands.
 */
public record MovieScreeningVersionRequest(
        @NotNull
        Integer formatId,

        @NotNull
        Integer audioFormatId,

        @NotBlank
        @Size(max = 10)
        String audioLanguageCode,

        @Size(max = 10)
        String subtitleLanguageCode,

        LocalDate effectiveFrom,

        LocalDate effectiveTo
) {
}
