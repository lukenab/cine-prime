package analyticsservice.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record AdminAnalyticsSummaryResponse(
        long confirmedBookings,
        long ticketsSold,
        BigDecimal ticketRevenue,
        BigDecimal concessionRevenue,
        BigDecimal grossRevenue,
        long refundCount,
        BigDecimal refundAmount,
        BigDecimal netRevenue,
        BigDecimal averageOrderValue,
        BigDecimal refundRate,
        String currency,
        OffsetDateTime dataThrough,
        Long dataFreshnessSeconds,
        String dataFreshnessStatus,
        AdminAnalyticsComparisonResponse previousPeriod) {
}
