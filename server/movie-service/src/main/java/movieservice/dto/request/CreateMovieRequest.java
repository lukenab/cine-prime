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
public class CreateMovieRequest {

    // ── Core ──────────────────────────────────────────────────
    @NotBlank
    @Size(max = 500)
    String originalTitle;

    /** ISO 639-1, e.g. "en", "ko", "ja" */
    @NotBlank
    @Size(min = 2, max = 2)
    String originalLanguage;

    @NotNull
    @Min(1)
    Integer durationMinutes;

    LocalDate releaseDate;

    LocalDate endDate;

    @Size(max = 100)
    String country;

    // ── FK references ─────────────────────────────────────────
    /** AgeRating.ratingId */
    Integer ageRatingId;

    /** ProductionCompany.companyId - all valid IDs are linked, no single-company limit */
    List<Long> companyIds;

    /** Genre IDs — min 1 required */
    @NotEmpty
    List<Long> genreIds;

    /** ScreeningFormat IDs — min 1 required */
    @NotEmpty
    List<Integer> formatIds;

    // ── Media ─────────────────────────────────────────────────
    @Size(max = 500)
    String posterUrl;

    @Size(max = 500)
    String thumbnailUrl;

    @Size(max = 500)
    String trailerUrl;

    String synopsis;

    // ── External IDs (optional, from TMDB import) ─────────────
    Integer tmdbId;

    @Size(max = 20)
    String imdbId;

    // ── Translations ──────────────────────────────────────────
    @Valid
    List<TranslationRequest> translations;

    // ── Cast ─────────────────────────────────────────────────
    @Valid
    List<CastRequest> cast;
}
