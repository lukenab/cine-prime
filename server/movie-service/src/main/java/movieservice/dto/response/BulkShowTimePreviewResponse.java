package movieservice.dto.response;

import lombok.AccessLevel;
import lombok.Builder;
import lombok.Data;
import lombok.experimental.FieldDefaults;

import java.util.List;

/**
 * Response body for POST /api/schedules/generate-preview.
 * No data is persisted — this is a dry-run result.
 */
@Data
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BulkShowTimePreviewResponse {

    /** Number of valid, conflict-free candidates. */
    int validCount;

    /** Number of candidates that would be skipped due to conflicts. */
    int conflictCount;

    /** Valid showtime slots that would be created on confirm. */
    List<ShowTimeCandidateDto> valid;

    /** Conflicting slots with the reason they were rejected. */
    List<ShowTimeConflictDto> conflicts;
}
