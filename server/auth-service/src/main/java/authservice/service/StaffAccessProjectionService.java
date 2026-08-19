package authservice.service;

import authservice.dto.StaffAccessEventPayload;
import authservice.entity.Account;
import authservice.entity.StaffAccessProjection;
import authservice.repository.StaffAccessProjectionRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.event.CanonicalEventEnvelope;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class StaffAccessProjectionService {
    static final String PRODUCER = "user-service";
    static final String SUPPORTED_EVENT_VERSION = "1";
    static final Set<String> STAFF_ROLES = Set.of("EMPLOYEE", "BRANCH_MANAGER", "PROGRAMMING_OPERATOR");
    static final Set<String> BRANCH_SCOPED_ROLES = Set.of("EMPLOYEE", "BRANCH_MANAGER");
    private static final Set<String> EVENT_TYPES = Set.of(
            "STAFF_ACCESS_ASSIGNED",
            "STAFF_ACCESS_UPDATED",
            "STAFF_ACCESS_SUSPENDED",
            "STAFF_ACCESS_REACTIVATED");

    private final ObjectMapper objectMapper;
    private final StaffAccessProjectionRepository projectionRepository;

    @Transactional
    public ProjectionResult project(String message) {
        CanonicalEventEnvelope<JsonNode> envelope = parseEnvelope(message);
        if (!PRODUCER.equals(envelope.producer())
                || !SUPPORTED_EVENT_VERSION.equals(envelope.eventVersion())
                || !EVENT_TYPES.contains(envelope.eventType())) {
            return ProjectionResult.IGNORED;
        }

        StaffAccessEventPayload payload = parsePayload(envelope.payload());
        validate(payload);
        StaffAccessProjection projection = projectionRepository
                .findByAccountIdForUpdate(payload.accountId())
                .orElse(null);
        if (projection != null && payload.assignmentVersion() <= projection.getLastAssignmentVersion()) {
            return envelope.eventId().equals(projection.getLastEventId())
                    ? ProjectionResult.DUPLICATE
                    : ProjectionResult.STALE;
        }
        if (projection == null) {
            projection = StaffAccessProjection.builder().accountId(payload.accountId()).build();
        }

        projection.setAccountRole(payload.accountRole().trim());
        projection.setAssignmentActive("ACTIVE".equals(payload.assignmentStatus()));
        projection.replaceClusterIds(normalizeClusterIds(payload.cinemaClusterIds()));
        projection.setLastEventId(envelope.eventId());
        projection.setLastEventVersion(envelope.eventVersion());
        projection.setLastAssignmentVersion(payload.assignmentVersion());
        projection.setLastEventOccurredAt(envelope.occurredAt());
        projectionRepository.save(projection);
        return ProjectionResult.PROJECTED;
    }

    @Transactional(readOnly = true)
    public StaffAuthorization resolve(Account account) {
        Set<String> accountRoles = account.getRoles() == null
                ? Set.of()
                : account.getRoles().stream().map(role -> role.getRoleName()).collect(java.util.stream.Collectors.toSet());
        Set<String> staffRoles = accountRoles.stream()
                .filter(STAFF_ROLES::contains)
                .collect(java.util.stream.Collectors.toSet());
        if (staffRoles.isEmpty()) {
            return StaffAuthorization.notApplicable();
        }

        return projectionRepository.findById(account.getAccountId())
                .filter(StaffAccessProjection::isAssignmentActive)
                .filter(projection -> staffRoles.contains(projection.getAccountRole()))
                .filter(projection -> !BRANCH_SCOPED_ROLES.contains(projection.getAccountRole())
                        || !projection.clusterIds().isEmpty())
                .map(projection -> new StaffAuthorization(
                        true, true, projection.getAccountRole(), projection.clusterIds()))
                .orElseGet(() -> StaffAuthorization.denied(true));
    }

    private CanonicalEventEnvelope<JsonNode> parseEnvelope(String message) {
        try {
            return objectMapper.readValue(message,
                    new TypeReference<CanonicalEventEnvelope<JsonNode>>() { });
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Invalid canonical staff access event", exception);
        }
    }

    private StaffAccessEventPayload parsePayload(JsonNode payload) {
        try {
            return objectMapper.treeToValue(payload, StaffAccessEventPayload.class);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Invalid staff access payload", exception);
        }
    }

    private void validate(StaffAccessEventPayload payload) {
        if (payload.accountId() == null || payload.accountId().isBlank()) {
            throw new IllegalArgumentException("accountId is required");
        }
        if (!STAFF_ROLES.contains(payload.accountRole())) {
            throw new IllegalArgumentException("Unsupported staff accountRole");
        }
        if (!Set.of("ACTIVE", "DISABLED").contains(payload.assignmentStatus())) {
            throw new IllegalArgumentException("Unsupported assignmentStatus");
        }
        if (payload.assignmentVersion() < 0) {
            throw new IllegalArgumentException("assignmentVersion cannot be negative");
        }
    }

    private List<String> normalizeClusterIds(List<String> values) {
        if (values == null) {
            return List.of();
        }
        return values.stream()
                .filter(value -> value != null && !value.isBlank())
                .map(String::trim)
                .filter(value -> !value.contains(","))
                .distinct()
                .sorted()
                .toList();
    }

    public record StaffAuthorization(
            boolean applicable,
            boolean authorized,
            String accountRole,
            List<String> cinemaClusterIds) {
        static StaffAuthorization notApplicable() {
            return new StaffAuthorization(false, true, null, List.of());
        }

        static StaffAuthorization denied(boolean applicable) {
            return new StaffAuthorization(applicable, false, null, List.of());
        }
    }

    public enum ProjectionResult {
        PROJECTED,
        DUPLICATE,
        STALE,
        IGNORED
    }
}
