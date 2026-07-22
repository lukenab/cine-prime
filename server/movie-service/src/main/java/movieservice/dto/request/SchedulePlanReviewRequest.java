package movieservice.dto.request;

import jakarta.validation.constraints.Size;

public record SchedulePlanReviewRequest(
        @Size(max = 2000) String note
) {
}

