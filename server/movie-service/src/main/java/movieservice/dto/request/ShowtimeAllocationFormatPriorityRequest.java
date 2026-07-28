package movieservice.dto.request;

import jakarta.validation.constraints.NotNull;

public record ShowtimeAllocationFormatPriorityRequest(
        @NotNull
        Integer formatId,

        @NotNull
        Integer allocationPriority
) {
}
