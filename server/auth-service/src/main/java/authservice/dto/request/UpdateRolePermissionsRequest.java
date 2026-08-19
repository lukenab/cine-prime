package authservice.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Set;

@Data
public class UpdateRolePermissionsRequest {
    @NotNull(message = "Permissions are required")
    private Set<String> permissions;
}
