package movieservice.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class MovieResponse {

    Long movieId;

    // ── Identifiers ───────────────────────────────────────────
    Integer tmdbId;
    String imdbId;
    String originalTitle;
    String originalLanguage;

    // ── Metadata ──────────────────────────────────────────────
    Integer durationMinutes;
    LocalDate releaseDate;
    String country;
    String status;

    // ── Lookup objects ────────────────────────────────────────
    AgeRatingResponse ageRating;

    // ── Production ────────────────────────────────────────────
    String companyName;

    // ── Media ─────────────────────────────────────────────────
    String posterUrl;
    String thumbnailUrl;
    String trailerUrl;
    String synopsis;

    // ── Collections ───────────────────────────────────────────
    List<GenreResponse> genres;
    List<ScreeningFormatResponse> formats;
    List<TranslationResponse> translations;
    List<CastResponse> cast;

    // ── Audit ─────────────────────────────────────────────────
    LocalDateTime createdAt;
    LocalDateTime updatedAt;
    String createdBy;
}
