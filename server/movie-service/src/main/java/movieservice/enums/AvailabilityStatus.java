package movieservice.enums;

/**
 * Per-cluster exhibition/release-plan status for a MovieAvailability window.
 * Independent from MovieStatus — a movie's content can be ARCHIVED while an
 * availability window (already CLOSED) still exists for historical record.
 */
public enum AvailabilityStatus {
    PLANNED,
    IN_REVIEW,
    CHANGES_REQUESTED,
    APPROVED,
    OPEN,
    SUSPENDED,
    CLOSED
}
