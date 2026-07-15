package movieservice.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;

import java.util.List;
import java.util.Map;

@Getter
public class TmdbImportRequest {

    @NotNull(message = "tmdbId is required")
    Integer tmdbId;

    /** Admin-confirmed rating; overrides the auto-resolved (VN/US certification) age rating when present. */
    Integer confirmedAgeRatingId;

    /** Required only when TMDB provides no runtime - import is blocked otherwise (TMDB-FIX-02). */
    Integer confirmedRuntimeMinutes;

    /** tmdbGenreId -> local genreId. Resolves an otherwise-UNMAPPED TMDB genre to an existing genre. */
    Map<Integer, Long> selectedGenreMappings;

    /** tmdbGenreIds to create as a new PENDING_REVIEW local genre (TMDB-FIX-03). */
    List<Integer> createPendingGenres;

    /** tmdbGenreId -> reason. Explicitly skip attaching this TMDB genre instead of blocking the import. */
    Map<Integer, String> ignoredGenres;
}
