package movieservice.dto.response;

import lombok.Builder;
import lombok.Getter;

/**
 * TMDB-FIX-03: unlike the old flat {@code genreIds: List<Long>}, every TMDB genre is reported here
 * - including ones that don't match a local Genre - so preview never silently drops one.
 * mappingStatus is one of MAPPED, PENDING_REVIEW, UNMAPPED.
 */
@Getter
@Builder
public class TmdbGenrePreview {
    Integer tmdbGenreId;
    String name;
    Long localGenreId;
    String mappingStatus;
}
