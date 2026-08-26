package movieservice.dto.response;

import java.util.List;

/** Movie-grouped release-planning queue. Branch plans remain nested in their movie row. */
public record ReleasePlanningQueuePageResponse(
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
            List<MovieAvailabilityResponse> plans
    ) {
    }

    public record Summary(
            long unplannedMovies,
            long needOperatorAction,
            long awaitingApproval,
            long activeReleases
    ) {
    }
}
