package authservice.dto.request;

import authservice.enums.AccountProvisioningRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

/**
 * Admin creates an account with only fullName + email + role — NO password field.
 * The account is created in PENDING status with an unusable placeholder password.
 * The employee sets their own password via the activation link sent to their email
 * (see ActivateAccountRequest / POST /api/auth/activate-account).
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class CreateAccountRequest {

    @NotBlank(message = "Full name is required")
    @Size(max = 100, message = "Full name must be at most 100 characters")
    String fullName;

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    String email;

    /** Role name, e.g. "MEMBER" / "EMPLOYEE" / "ADMIN". Free-text for now — see Issue #157. */
    @NotNull(message = "Role is required")
    AccountProvisioningRole role;
}
