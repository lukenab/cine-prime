package analyticsservice.dto;

import java.math.BigDecimal;

public record AdminAnalyticsBranchRankingResponse(
        long rank,
        Long clusterId,
        long confirmedBookings,
        long ticketsSold,
        BigDecimal grossRevenue,
        BigDecimal netRevenue,
        BigDecimal averageOrderValue,
        BigDecimal refundRate) {
}
