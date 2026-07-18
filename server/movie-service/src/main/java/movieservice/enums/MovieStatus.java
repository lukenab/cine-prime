package movieservice.enums;

/**
 * Movie content-review status only. Does NOT represent exhibition/publish
 * state — a movie can be APPROVED and still not be showing anywhere, or
 * showing at one cluster and not another. See MovieAvailability for that.
 * See docs/api-specs/movie-service/MOVIE_LIFECYCLE_CONTRACT.md.
 */
public enum MovieStatus {
    DRAFT,
    PENDING_REVIEW,
    APPROVED,
    CHANGES_REQUESTED,
    ARCHIVED
}
