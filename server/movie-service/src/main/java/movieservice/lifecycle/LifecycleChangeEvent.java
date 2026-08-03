package movieservice.lifecycle;

import java.time.Instant;

/**
 * Lightweight invalidation event for internal and public web clients. REST remains the
 * source of truth; consumers use this message only as a signal to refetch authorized data.
 */
public record LifecycleChangeEvent(
        String aggregateType,
        Long aggregateId,
        String status,
        String action,
        Long movieId,
        Long clusterId,
        Instant occurredAt) {
}
