package userservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthAccountInvitationRequest {
    private String fullName;
    private String email;
    private String phoneNumber;
    private String role;
}
