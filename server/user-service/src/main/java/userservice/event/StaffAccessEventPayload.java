package userservice.event;

import java.util.List;

/** Minimal authorization data projected into auth-service. */
public record StaffAccessEventPayload(
        String accountId,
        String accountRole,
        String accessProfile,
        String assignmentStatus,
        List<String> cinemaClusterIds,
        long assignmentVersion) {
}
