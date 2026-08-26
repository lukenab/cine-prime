package movieservice.dto.response;

import movieservice.enums.MovieStatus;

import java.util.List;

/**
 * Movie-grouped page used by the operational screening-version catalogue.
 * Pagination is deliberately applied to movies, never individual versions, so
 * one movie cannot be split across two pages.
 */
public record ScreeningVersionCatalogPageResponse(
        List<MovieGroup> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        Summary summary
) {
    public record MovieGroup(
            Long movieId,
            String displayTitle,
            String originalTitle,
            String posterUrl,
            MovieStatus movieStatus,
            List<MovieScreeningVersionCatalogResponse> versions
    ) {
    }

    public record Summary(
            long moviesCovered,
            long totalVersions,
            long schedulable,
            long needsAttention
    ) {
    }
}
