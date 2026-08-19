package authservice.dto.request;

import authservice.enums.StaffProvisioningRole;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InternalStaffRoleUpdateRequest {
    @NotNull(message = "Staff role is required")
    private StaffProvisioningRole role;
}
