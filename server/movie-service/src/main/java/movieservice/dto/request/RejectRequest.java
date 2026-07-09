package movieservice.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;

@Getter
public class RejectRequest {

    @NotBlank(message = "Rejection note must not be blank")
    String note;
}
