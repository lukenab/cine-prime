package movieservice.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
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

    Integer tmdbId;
    String imdbId;
    String originalTitle;
    String originalLanguage;

    Integer durationMinutes;
    LocalDate releaseDate;
    String country;
    String status;
    String rejectionNote;

    AgeRatingResponse ageRating;

    List<ProductionCompanyResponse> companies;
    String posterUrl;
    String thumbnailUrl;
    String trailerUrl;
    String trailerSource;
    String synopsis;
    String tagline;
    String taglineSource;

    List<GenreResponse> genres;
    List<ScreeningFormatResponse> formats;
    List<TranslationResponse> translations;
    List<CastResponse> cast;
    List<MovieImageResponse> images;

    // ── Scheduling profile (movie_scheduling_profile) — see MovieSchedulingProfile.
    //    Populated on single-movie reads (getMovie/getMovieByLang) and after create/update;
    //    left null if the movie somehow has no profile row yet (should not happen once
    //    createMovie() always creates one, but read paths tolerate it defensively). ──
    BigDecimal popularityScore;
    BigDecimal priorityOverride;
    String scoreSource;

    LocalDateTime createdAt;
    LocalDateTime updatedAt;
    String createdBy;
    String updatedBy;
    Long version;
}
