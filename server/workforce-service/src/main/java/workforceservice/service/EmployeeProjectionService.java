package workforceservice.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.*;
import lombok.RequiredArgsConstructor;
import movie.theater.common.event.CanonicalEventEnvelope;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import workforceservice.entity.EmployeeProjection;
import workforceservice.repository.WorkforceStore;
import java.time.OffsetDateTime;
import java.util.*;

@Service @RequiredArgsConstructor
public class EmployeeProjectionService {
    private static final Set<String> TYPES = Set.of("STAFF_ACCESS_ASSIGNED", "STAFF_ACCESS_UPDATED", "STAFF_ACCESS_SUSPENDED", "STAFF_ACCESS_REACTIVATED");
    private final ObjectMapper objectMapper;
    private final WorkforceStore store;

    @Transactional
    public ProjectionResult project(String message) {
        try {
            CanonicalEventEnvelope<JsonNode> event = objectMapper.readValue(message, new TypeReference<>() {});
            if (!"user-service".equals(event.producer()) || !"1".equals(event.eventVersion()) || !TYPES.contains(event.eventType())) return ProjectionResult.IGNORED;
            Payload payload = objectMapper.treeToValue(event.payload(), Payload.class);
            if (payload.accountId() == null || payload.accountId().isBlank() || payload.assignmentVersion() < 0) throw new IllegalArgumentException("Invalid staff projection payload");
            EmployeeProjection current = store.findProjectionForUpdate(payload.accountId()).orElse(null);
            if (current != null && payload.assignmentVersion() <= current.getLastAssignmentVersion()) {
                return event.eventId().equals(current.getLastEventId()) ? ProjectionResult.DUPLICATE : ProjectionResult.STALE;
            }
            List<String> clusters = payload.cinemaClusterIds() == null ? List.of() : payload.cinemaClusterIds().stream()
                    .filter(Objects::nonNull).map(String::trim).filter(v -> !v.isBlank() && !v.contains(",")).distinct().sorted().toList();
            EmployeeProjection projection = current == null ? EmployeeProjection.builder().accountId(payload.accountId()).build() : current;
            projection.setAccountRole(payload.accountRole());
            projection.setAssignmentActive("ACTIVE".equals(payload.assignmentStatus()));
            projection.replaceClusterIds(clusters);
            projection.setLastEventId(event.eventId());
            projection.setLastEventVersion(event.eventVersion());
            projection.setLastAssignmentVersion(payload.assignmentVersion());
            projection.setLastEventOccurredAt(event.occurredAt());
            projection.setUpdatedAt(OffsetDateTime.now());
            store.save(projection);
            return ProjectionResult.PROJECTED;
        } catch (Exception exception) {
            throw new IllegalArgumentException("Invalid canonical staff access event", exception);
        }
    }

    public record Payload(String accountId, String accountRole, String assignmentStatus,
                          List<String> cinemaClusterIds, long assignmentVersion) {}
    public enum ProjectionResult { PROJECTED, DUPLICATE, STALE, IGNORED }
}
