package authservice.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.Set;

@Data
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class AccountResponse {
    String accountId;
    String username;
    String email;
    LocalDateTime createdAt;

    Set<RoleResponse> roles;
}
