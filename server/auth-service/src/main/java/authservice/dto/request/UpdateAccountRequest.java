package authservice.dto.request;

import authservice.enums.AccountStatus;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class UpdateAccountRequest {

    // Auth-service only owns these fields
    String email;
    List<String> roles;
    AccountStatus status;
}
