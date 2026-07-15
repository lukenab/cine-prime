package movieservice.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

/** Response for POST /api/movies/tmdb/genres/sync (TMDB-FIX-03) - read-only taxonomy comparison. */
@Getter
@Builder
public class TmdbGenreSyncResponse {
    int mapped;
    List<UnmappedGenre> unmapped;

    @Getter
    @Builder
    public static class UnmappedGenre {
        Integer tmdbGenreId;
        String name;
        String status;
    }
}
