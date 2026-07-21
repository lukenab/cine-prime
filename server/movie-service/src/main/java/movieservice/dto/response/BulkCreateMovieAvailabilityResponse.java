package movieservice.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BulkCreateMovieAvailabilityResponse {

    List<MovieAvailabilityResponse> created;
    List<SkippedCluster> skipped;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class SkippedCluster {
        Long clusterId;
        String clusterName;
        /** Human-readable, e.g. "Cluster is not ACTIVE" or "A release plan for this
         *  movie/cluster/date already exists" - not an error code, this is a best-effort
         *  batch operation, not a transaction that rolls back on the first conflict. */
        String reason;
    }
}
