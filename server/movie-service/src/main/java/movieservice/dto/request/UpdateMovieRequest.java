package movieservice.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UpdateMovieRequest {

    // ── Core (all optional — only provided fields are updated) ─
    @Size(max = 500)
    String originalTitle;

    @Size(min = 2, max = 2)
    String originalLanguage;

    @Min(1)
    Integer durationMinutes;

    LocalDate releaseDate;

    @Size(max = 100)
    String country;

    // ── FK references ─────────────────────────────────────────
    Integer ageRatingId;
    Long companyId;
    List<Long> genreIds;
    List<Integer> formatIds;

    // ── Media ─────────────────────────────────────────────────
    @Size(max = 500)
    String posterUrl;

    @Size(max = 500)
    String thumbnailUrl;

    @Size(max = 500)
    String trailerUrl;

    String synopsis;

    // ── Translations (full replacement when provided) ─────────
    @Valid
    List<TranslationRequest> translations;

    // ── Cast (full replacement when provided) ─────────────────
    @Valid
    List<CastRequest> cast;
}
