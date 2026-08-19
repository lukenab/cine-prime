package authservice.dto.request;

import authservice.enums.StaffProvisioningRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Minimal credential data sent by user-service after it validates the job assignment. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InternalStaffInvitationRequest {

    @NotBlank(message = "Full name is required")
    @Size(max = 100, message = "Full name must be at most 100 characters")
    private String fullName;

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @Pattern(regexp = "^(0|\\+84)[0-9]{9,10}$", message = "Invalid phone number format")
    private String phoneNumber;

    @NotNull(message = "Role is required")
    private StaffProvisioningRole role;
}
