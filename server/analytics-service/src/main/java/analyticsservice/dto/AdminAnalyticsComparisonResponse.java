package analyticsservice.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Comparison of the selected range with the immediately preceding range of equal length. */
public record AdminAnalyticsComparisonResponse(
        LocalDate from,
        LocalDate to,
        long confirmedBookingsDelta,
        BigDecimal confirmedBookingsChangePercent,
        long ticketsSoldDelta,
        BigDecimal ticketsSoldChangePercent,
        BigDecimal grossRevenueDelta,
        BigDecimal grossRevenueChangePercent,
        BigDecimal averageOrderValueDelta,
        BigDecimal averageOrderValueChangePercent,
        BigDecimal refundRateDelta,
        BigDecimal refundRateChangePercent,
        BigDecimal netRevenueDelta,
        BigDecimal netRevenueChangePercent) {
}
