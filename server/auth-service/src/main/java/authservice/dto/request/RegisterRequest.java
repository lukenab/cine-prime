package authservice.dto.request;

import authservice.validator.DobConstraint;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;

@Data
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class RegisterRequest {

    @NotBlank(message = "Username cannot be blank!")
    @Size(min = 5, max = 50, message = "Username must be between 5 and 50 characters!")
    String username;

    @NotBlank(message = "Password cannot be blank!")
    @Size(min = 6, message = "Password must be at least 6 characters!")
    String password;

    @NotBlank(message = "Email cannot be blank!")
    @Email(message = "Invalid email format (e.g., example@gmail.com)!")
    String email;

    @NotBlank(message = "Full name cannot be blank!")
    String fullName;

    @NotBlank(message = "Phone number cannot be blank!")
    @Pattern(regexp = "^(0[3|5|7|8|9])+([0-9]{8})$", message = "Invalid phone number format!")
    String phoneNumber;

    @DobConstraint(min = 2)
    LocalDate dateOfBirth;

    @NotBlank(message = "Gender cannot be blank!")
    String gender;

    @NotBlank(message = "Address cannot be blank!")
    String address;

    @NotBlank(message = "Identity card cannot be blank!")
    @Pattern(regexp = "^[0-9]{12}$", message = "Identity card must contain exactly 12 digits!")
    String identityCard;
    
    String role;
}