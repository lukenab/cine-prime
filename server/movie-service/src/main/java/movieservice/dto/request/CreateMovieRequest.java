package movieservice.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
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

    /**
     * Legacy presentation-format projection.
     * New clients configure complete MovieScreeningVersion records after saving the draft.
     */
    List<Integer> formatIds;

    // ── Media ─────────────────────────────────────────────────
    @Size(max = 500)
    String posterUrl;

    @Size(max = 500)
    String thumbnailUrl;

    @Size(max = 500)
    String trailerUrl;

    String synopsis;

    /** Original-language tagline - mirrors synopsis. Localized ones live on each translation. */
    @Size(max = 500)
    String tagline;

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

    // ── Scheduling profile (movie_scheduling_profile) ──────────
    /** How strongly this title should be favored by the auto-showtime allocator relative to
     *  other movies (AutoShowtimeCandidateScorer's movieDemandWeight input). Defaults to 0
     *  (no signal) when omitted - an operator sets this from TMDB popularity, box-office
     *  performance, or manual judgement. */
    @DecimalMin(value = "0", message = "popularityScore must be between 0 and 100.")
    @DecimalMax(value = "100", message = "popularityScore must be between 0 and 100.")
    BigDecimal popularityScore;

    /** Optional manual override that bypasses the derived popularity ranking entirely for
     *  this movie (e.g. a tentpole release that must always win contested slots). Null means
     *  "no override - use popularityScore normally". */
    BigDecimal priorityOverride;
}
