package authservice.dto.request;

import authservice.entity.Role;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;

@Data
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class RegisterRequest {
    String username;
    String password;
    String email;
    String fullName;
    String phoneNumber;
    LocalDate dateOfBirth;
    String gender;
    String address;
    String identityCard;
}
