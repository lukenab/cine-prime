package authservice.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.Set;

@Data
@Builder
public class InternalAccountResponse {
    private String accountId;
    private String email;
    private String status;
    private Set<String> roles;
}
