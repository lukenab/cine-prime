package analyticsservice.service;

import analyticsservice.entity.BookingOutcomeStatus;
import analyticsservice.entity.BookingRevenueFact;
import analyticsservice.repository.BookingRevenueFactRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

class AdminAnalyticsSummaryServiceTest {
    private final BookingRevenueFactRepository repository = Mockito.mock(BookingRevenueFactRepository.class);
    private final AdminAnalyticsSummaryService service = new AdminAnalyticsSummaryService(repository);

    @BeforeEach
    void grantAdminScope() {
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken("admin", "n/a", "ROLE_ADMIN"));
    }

    @AfterEach
    void clearScope() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void summaryCalculatesAovRefundRateAndPreviousPeriodComparison() {
        LocalDate from = LocalDate.of(2026, 8, 1);
        LocalDate to = LocalDate.of(2026, 8, 7);
        when(repository.findAllByClusterIdAndBusinessDateBetweenAndCurrencyIgnoreCase(1L, from, to, "VND"))
                .thenReturn(List.of(fact("current-1", 1L, from, 300_000, 0, BookingOutcomeStatus.CONFIRMED),
                        fact("current-2", 1L, from.plusDays(1), 500_000, 0, BookingOutcomeStatus.CONFIRMED),
                        fact("current-refund", 1L, from.plusDays(1), 200_000, 200_000, BookingOutcomeStatus.REFUNDED)));
        when(repository.findAllByClusterIdAndBusinessDateBetweenAndCurrencyIgnoreCase(1L, from.minusDays(7), from.minusDays(1), "VND"))
                .thenReturn(List.of(fact("previous-1", 1L, from.minusDays(7), 400_000, 0, BookingOutcomeStatus.CONFIRMED)));

        var result = service.summary(1L, from, to);

        assertThat(result.confirmedBookings()).isEqualTo(2);
        assertThat(result.grossRevenue()).isEqualByComparingTo("800000");
        assertThat(result.averageOrderValue()).isEqualByComparingTo("400000.00");
        assertThat(result.refundRate()).isEqualByComparingTo("50.00");
        assertThat(result.previousPeriod()).isNotNull();
        assertThat(result.previousPeriod().grossRevenueChangePercent()).isEqualByComparingTo("100.00");
    }

    @Test
    void rankingOrdersBranchesByGrossRevenue() {
        LocalDate from = LocalDate.of(2026, 8, 1);
        LocalDate to = LocalDate.of(2026, 8, 7);
        when(repository.findAllByBusinessDateBetweenAndCurrencyIgnoreCase(any(), any(), any()))
                .thenReturn(List.of(fact("branch-1", 1L, from, 900_000, 0, BookingOutcomeStatus.CONFIRMED),
                        fact("branch-2", 2L, from, 500_000, 0, BookingOutcomeStatus.CONFIRMED)));

        var result = service.ranking(from, to);

        assertThat(result).extracting("clusterId").containsExactly(1L, 2L);
        assertThat(result).extracting("rank").containsExactly(1L, 2L);
    }

    private BookingRevenueFact fact(String eventId, Long clusterId, LocalDate date, long amount, long refund, BookingOutcomeStatus status) {
        return BookingRevenueFact.builder()
                .sourceEventId(eventId)
                .eventVersion("2")
                .bookingId("booking-" + eventId)
                .clusterId(clusterId)
                .showtimeId(1L)
                .businessDate(date)
                .occurredAt(date.atStartOfDay().atOffset(java.time.ZoneOffset.ofHours(7)))
                .projectedAt(OffsetDateTime.now())
                .ticketCount(2)
                .ticketAmount(BigDecimal.valueOf(amount))
                .concessionAmount(BigDecimal.ZERO)
                .discountAmount(BigDecimal.ZERO)
                .finalAmount(BigDecimal.valueOf(amount))
                .refundAmount(BigDecimal.valueOf(refund))
                .currency("VND")
                .outcomeStatus(status)
                .build();
    }
}
