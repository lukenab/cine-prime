package authservice.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class UserProfileResponse {
    String accountId;
    String fullName;
    String phoneNumber;
    String identityCard;
}
