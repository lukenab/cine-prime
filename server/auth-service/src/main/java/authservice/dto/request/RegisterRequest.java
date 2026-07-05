package authservice.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@AllArgsConstructor @NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RegisterRequest {

    @NotBlank(message = "Username cannot be blank!")
    @Size(min = 5, max = 50, message = "Username must be between 5 and 50 characters!")
    @Pattern(regexp = "^[a-zA-Z0-9_]+$", message = "Username can only contain letters, digits and underscores!")
    String username;

    @NotBlank(message = "Email cannot be blank!")
    @Email(message = "Invalid email format (e.g., example@gmail.com")
    String email;

    @NotBlank(message = "Password cannot be blank!")
    @Size(min = 8, message = "Password must be at least 8 characters!")
    String password;

}