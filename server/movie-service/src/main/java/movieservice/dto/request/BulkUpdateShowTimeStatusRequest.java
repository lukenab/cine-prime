package movieservice.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import movieservice.enums.ShowTimeStatus;

import java.util.List;

public record BulkUpdateShowTimeStatusRequest(
        @NotEmpty
        @Size(max = 100)
        List<Long> showtimeIds,
        @NotNull ShowTimeStatus status,
        @Size(max = 1000) String reason
) {
}
