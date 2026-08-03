package movieservice.dto.request;

import jakarta.validation.constraints.Size;

public record ReleasePlanReviewRequest(
        @Size(max = 500, message = "Review note must not exceed 500 characters")
        String note) {
}
