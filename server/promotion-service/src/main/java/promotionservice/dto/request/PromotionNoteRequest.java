package promotionservice.dto.request;

import jakarta.validation.constraints.Size;

/** Optional context recorded with a workflow transition. */
public record PromotionNoteRequest(
        @Size(max = 500, message = "Comment must be at most 500 characters") String comment
) {}
