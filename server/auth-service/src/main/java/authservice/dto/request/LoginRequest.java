package authservice.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class LoginRequest {
    @NotBlank(message = "Email or username cannot be blank!")
    String username;

    @NotBlank(message = "Password cannot be blank!")
    String password;
}
