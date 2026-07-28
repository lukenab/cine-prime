package movieservice.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.MaintenanceSeverity;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CinemaRoomMaintenanceResponse {
    Long maintenanceId;
    Long cinemaRoomId;
    String reason;
    MaintenanceSeverity severity;
    LocalDateTime startedAt;
    LocalDateTime resolvedAt;
    Boolean resolved;
    String resolutionNote;
    String createdBy;
    LocalDateTime createdAt;
}
