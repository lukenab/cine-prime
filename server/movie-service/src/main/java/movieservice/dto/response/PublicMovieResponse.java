package movieservice.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

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
    List<GenreResponse> genres;

    /** NOW_SHOWING | COMING_SOON */
    String displayStatus;

    /** Null when the request had no clusterId (aggregate discovery — see contract note). */
    Long clusterId;
    String clusterName;

    LocalDateTime nextShowtimeAt;
    boolean bookingAvailable;
}
