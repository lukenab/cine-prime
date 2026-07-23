package movieservice.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import movieservice.enums.ShowTimeStatus;

public record UpdateShowTimeStatusRequest(
        @NotNull ShowTimeStatus status,
        @Size(max = 1000) String reason
) {
}
