package authservice.dto.request;

import authservice.enums.AccountProvisioningRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Pattern;
import lombok.*;
import lombok.experimental.FieldDefaults;
import java.time.LocalDate;

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

    /** Provisioning is intentionally limited to non-administrative roles. */
    @NotNull(message = "Role is required")
    AccountProvisioningRole role;

    @Pattern(regexp = "^(0|\\+84)[0-9]{9,10}$", message = "Invalid phone number format")
    String phoneNumber;

    LocalDate dateOfBirth;

    @Pattern(regexp = "^(Male|Female|Other)$", message = "Gender must be Male, Female, or Other")
    String gender;

    @Pattern(regexp = "^[0-9]{12}$", message = "Identity card must contain exactly 12 digits")
    String identityCard;

    @Size(max = 255)
    String address;
}
