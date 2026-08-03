package authservice.dto.request;

import authservice.enums.AccountStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class InternalAccountStatusRequest {
    @NotNull
    private AccountStatus status;
}
