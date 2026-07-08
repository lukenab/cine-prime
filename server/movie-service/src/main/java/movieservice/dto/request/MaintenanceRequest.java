package movieservice.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.MaintenanceSeverity;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class MaintenanceRequest {

    @NotBlank(message = "Reason is required")
    String reason;

    @NotNull(message = "Severity is required (LOW | MEDIUM | HIGH | CRITICAL)")
    MaintenanceSeverity severity;

    LocalDateTime startedAt;
}
