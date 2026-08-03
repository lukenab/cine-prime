package authservice.event;

import lombok.*;
import lombok.experimental.FieldDefaults;
import java.time.LocalDate;

@Data
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class UserRegisteredEvent {
    String accountId;
    String email;
    String fullName;
    String phoneNumber;
    LocalDate dateOfBirth;
    String gender;
    String identityCard;
    String address;
}
