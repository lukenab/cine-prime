package movieservice.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;

@Getter
public class SuspendRequest {

    @NotBlank(message = "Suspend reason must not be blank")
    String reason;
}
