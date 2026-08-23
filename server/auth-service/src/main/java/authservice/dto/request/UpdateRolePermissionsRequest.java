package authservice.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.Set;

@Data
public class UpdateRolePermissionsRequest {
    @NotNull(message = "Permissions are required")
    private Set<String> permissions;

    @Size(max = 500, message = "Change reason must not exceed 500 characters")
    private String changeReason;
}
