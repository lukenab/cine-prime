package authservice.event;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AccountActivationRequestedEvent {
    String email;
    String fullName;
    String activationLink;
    int expiryHours;
}
