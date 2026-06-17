package authservice.dto.request;

import authservice.entity.Role;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;
import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class AccountUpdateRequest {

    String email;
    String password;
    List<String> roles;

    String fullName;
    String phoneNumber;
    LocalDate dateOfBirth;
    String gender;
    String address;
    String identityCard;
}
