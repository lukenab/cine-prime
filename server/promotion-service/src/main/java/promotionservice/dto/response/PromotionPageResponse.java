package promotionservice.dto.response;

import java.util.List;

/** Stable API contract that does not expose Spring Data's PageImpl. */
public record PromotionPageResponse(
        List<PromotionSummaryResponse> content,
        long totalElements,
        int totalPages,
        int number,
        int size,
        PromotionCounts counts
) {
    public record PromotionCounts(long total, long draft, long pendingApproval, long approved,
                                  long rejected, long active, long paused, long archived,
                                  long approvedOrScheduled, long activeNow) {}
}
