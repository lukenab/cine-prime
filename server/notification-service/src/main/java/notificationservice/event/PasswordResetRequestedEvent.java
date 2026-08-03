package notificationservice.event;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PasswordResetRequestedEvent {
    private String email;
    private String resetLink;
    private int expiryMinutes;
}
