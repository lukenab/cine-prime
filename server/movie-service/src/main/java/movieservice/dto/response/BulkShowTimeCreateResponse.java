package movieservice.dto.response;

import lombok.AccessLevel;
import lombok.Builder;
import lombok.Data;
import lombok.experimental.FieldDefaults;

import java.util.List;

/**
 * Response body for POST /api/schedules/bulk.
 * Contains the persisted showtimes and the skipped conflicts.
 */
@Data
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BulkShowTimeCreateResponse {

    /** Number of showtimes successfully created. */
    int createdCount;

    /** Number of candidates skipped due to conflicts. */
    int skippedCount;

    /** Full details of created showtimes. */
    List<ShowTimeResponse> created;

    /** Conflict rows that were skipped (not saved). */
    List<ShowTimeConflictDto> skipped;
}
