package analyticsservice.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record AdminAnalyticsDailyPointResponse(
        LocalDate date,
        long confirmedBookings,
        long ticketsSold,
        BigDecimal ticketRevenue,
        BigDecimal concessionRevenue,
        BigDecimal grossRevenue,
        long refundCount,
        BigDecimal refundAmount,
        BigDecimal netRevenue) {
}
