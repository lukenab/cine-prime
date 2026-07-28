package movieservice.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Read-model for customer-facing listings (MOV-LC-07). displayStatus is
 * derived at read time from content approval + cluster availability +
 * showtimes — it is never persisted on Movie.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PublicMovieResponse {

    Long movieId;
    String originalTitle;
    String posterUrl;
    String thumbnailUrl;
    String trailerUrl;
    String synopsis;
    Integer durationMinutes;
    LocalDate releaseDate;
    List<GenreResponse> genres;

    /** NOW_SHOWING | COMING_SOON */
    String displayStatus;

    /** Null when the request had no clusterId (aggregate discovery — see contract note). */
    Long clusterId;
    String clusterName;

    LocalDateTime nextShowtimeAt;
    boolean bookingAvailable;

    /** Detail-only fields — populated by getPublicMovieDetail() (single-movie fetch),
     *  left null by findAllPublic() (list) to avoid N+1 loading cast/images/companies
     *  for every movie in a catalogue page. Deliberately excludes editorial-only data
     *  the admin MovieResponse carries (tmdbId, imdbId, rejectionNote, status, trailerSource,
     *  taglineSource, createdAt/updatedAt/createdBy) — none of that is customer-facing. */
    String tagline;
    String country;
    String originalLanguage;
    AgeRatingResponse ageRating;
    List<ScreeningFormatResponse> formats;
    List<ProductionCompanyResponse> companies;
    List<TranslationResponse> translations;
    List<CastResponse> cast;
    List<MovieImageResponse> images;
}
