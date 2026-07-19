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

    Integer tmdbId;
    String imdbId;
    String originalTitle;
    String originalLanguage;

    Integer durationMinutes;
    LocalDate releaseDate;
    LocalDate endDate;
    String country;
    String status;

    AgeRatingResponse ageRating;

    String companyName;
    String posterUrl;
    String thumbnailUrl;
    String trailerUrl;
    /** TMDB = auto-selected on import; MANUAL = admin-entered/edited. */
    String trailerSource;
    String synopsis;

    List<GenreResponse> genres;
    List<ScreeningFormatResponse> formats;
    List<TranslationResponse> translations;
    List<CastResponse> cast;
    List<MovieImageResponse> images;
    
    LocalDateTime createdAt;
    LocalDateTime updatedAt;
    String createdBy;
}
