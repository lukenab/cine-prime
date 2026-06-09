package authservice.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;

@Data
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class UserCreationRequest {
    String accountId; 
    String fullName;
    String phoneNumber;
    LocalDate dateOfBirth;
    String email;
    String gender;
    String address;
    String identityCard;
}
