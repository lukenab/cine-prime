package authservice.dto;

import java.util.List;

public record StaffAccessEventPayload(
        String accountId,
        String accountRole,
        String accessProfile,
        String assignmentStatus,
        List<String> cinemaClusterIds,
        long assignmentVersion) {
}
