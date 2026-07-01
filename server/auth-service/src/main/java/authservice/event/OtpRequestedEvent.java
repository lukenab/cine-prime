package authservice.event;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class    OtpRequestedEvent {
    String email;
    String otp;
    int expiryMinutes;
}
