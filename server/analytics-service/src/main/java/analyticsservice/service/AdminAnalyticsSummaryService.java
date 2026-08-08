package analyticsservice.service;

import analyticsservice.dto.AdminAnalyticsDailyPointResponse;
import analyticsservice.dto.AdminAnalyticsBranchRankingResponse;
import analyticsservice.dto.AdminAnalyticsComparisonResponse;
import analyticsservice.dto.AdminAnalyticsSummaryResponse;
import analyticsservice.entity.BookingOutcomeStatus;
import analyticsservice.entity.BookingRevenueFact;
import analyticsservice.repository.BookingRevenueFactRepository;
import lombok.RequiredArgsConstructor;
import movie.theater.common.security.JwtBranchScope;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.Duration;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Service
@RequiredArgsConstructor
public class AdminAnalyticsSummaryService {
    private static final String CURRENCY = "VND";
    private static final long FRESHNESS_WINDOW_SECONDS = 15 * 60;

    private final BookingRevenueFactRepository factRepository;

    public AdminAnalyticsSummaryResponse summary(Long clusterId, LocalDate from, LocalDate to) {
        List<BookingRevenueFact> facts = factsInScope(clusterId, from, to);
        long span = daySpan(from, to);
        List<BookingRevenueFact> previousFacts = factsInScope(clusterId, from.minusDays(span), from.minusDays(1));

        OffsetDateTime dataThrough = facts.stream()
                .map(BookingRevenueFact::getProjectedAt)
                .filter(java.util.Objects::nonNull)
                .max(Comparator.naturalOrder())
                .orElse(null);
        AdminAnalyticsSummaryResponse current = toSummary(facts, dataThrough);
        AdminAnalyticsSummaryResponse previous = toSummary(previousFacts, null);
        return withPreviousPeriod(current, comparison(current, previous, from.minusDays(span), from.minusDays(1)));
    }

    public List<AdminAnalyticsBranchRankingResponse> ranking(LocalDate from, LocalDate to) {
        validateRange(from, to);
        List<AdminAnalyticsBranchRankingResponse> ranked = factRepository.findAllByBusinessDateBetweenAndCurrencyIgnoreCase(from, to, CURRENCY).stream()
                .filter(fact -> JwtBranchScope.canAccess(fact.getClusterId()))
                .collect(Collectors.groupingBy(BookingRevenueFact::getClusterId))
                .entrySet().stream()
                .map(entry -> {
                    AdminAnalyticsSummaryResponse summary = toSummary(entry.getValue(), null);
                    return new AdminAnalyticsBranchRankingResponse(
                            0,
                            entry.getKey(),
                            summary.confirmedBookings(),
                            summary.ticketsSold(),
                            summary.grossRevenue(),
                            summary.netRevenue(),
                            summary.averageOrderValue(),
                            summary.refundRate());
                })
                .sorted(Comparator.comparing(AdminAnalyticsBranchRankingResponse::grossRevenue).reversed()
                        .thenComparing(Comparator.comparing(AdminAnalyticsBranchRankingResponse::confirmedBookings).reversed()))
                .toList();
        return IntStream.range(0, ranked.size())
                .mapToObj(index -> {
                    AdminAnalyticsBranchRankingResponse value = ranked.get(index);
                    return new AdminAnalyticsBranchRankingResponse(index + 1L, value.clusterId(), value.confirmedBookings(),
                            value.ticketsSold(), value.grossRevenue(), value.netRevenue(), value.averageOrderValue(), value.refundRate());
                })
                .toList();
    }

    /// One row per calendar day in range, even days with zero activity, so the trend chart
    /// on the frontend never has to guess about gaps versus zero.
    public List<AdminAnalyticsDailyPointResponse> daily(Long clusterId, LocalDate from, LocalDate to) {
        List<BookingRevenueFact> facts = factsInScope(clusterId, from, to);
        Map<LocalDate, List<BookingRevenueFact>> byDay = facts.stream()
                .collect(Collectors.groupingBy(BookingRevenueFact::getBusinessDate, TreeMap::new, Collectors.toList()));

        List<AdminAnalyticsDailyPointResponse> points = new java.util.ArrayList<>();
        for (LocalDate date = from; !date.isAfter(to); date = date.plusDays(1)) {
            AdminAnalyticsSummaryResponse day = toSummary(byDay.getOrDefault(date, List.of()), null);
            points.add(new AdminAnalyticsDailyPointResponse(
                    date,
                    day.confirmedBookings(),
                    day.ticketsSold(),
                    day.ticketRevenue(),
                    day.concessionRevenue(),
                    day.grossRevenue(),
                    day.refundCount(),
                    day.refundAmount(),
                    day.netRevenue()));
        }
        return points;
    }

    private List<BookingRevenueFact> factsInScope(Long clusterId, LocalDate from, LocalDate to) {
        validateRange(from, to);
        if (clusterId != null && !JwtBranchScope.canAccess(clusterId)) {
            throw new org.springframework.security.access.AccessDeniedException("Cluster is outside your branch scope");
        }
        List<BookingRevenueFact> facts = clusterId == null
                ? factRepository.findAllByBusinessDateBetweenAndCurrencyIgnoreCase(from, to, CURRENCY)
                : factRepository.findAllByClusterIdAndBusinessDateBetweenAndCurrencyIgnoreCase(clusterId, from, to, CURRENCY);
        return facts.stream()
                .filter(fact -> JwtBranchScope.canAccess(fact.getClusterId()))
                .toList();
    }

    private AdminAnalyticsSummaryResponse toSummary(List<BookingRevenueFact> facts, OffsetDateTime dataThrough) {
        long confirmedBookings = facts.stream().filter(f -> f.getOutcomeStatus() == BookingOutcomeStatus.CONFIRMED).count();
        long ticketsSold = facts.stream()
                .filter(f -> f.getOutcomeStatus() == BookingOutcomeStatus.CONFIRMED)
                .mapToLong(f -> f.getTicketCount() == null ? 0L : f.getTicketCount())
                .sum();
        BigDecimal ticketRevenue = sum(facts, BookingOutcomeStatus.CONFIRMED, BookingRevenueFact::getTicketAmount);
        BigDecimal concessionRevenue = sum(facts, BookingOutcomeStatus.CONFIRMED, BookingRevenueFact::getConcessionAmount);
        BigDecimal grossRevenue = sum(facts, BookingOutcomeStatus.CONFIRMED, BookingRevenueFact::getFinalAmount);
        long refundCount = facts.stream().filter(f -> f.getOutcomeStatus() == BookingOutcomeStatus.REFUNDED).count();
        BigDecimal refundAmount = sum(facts, BookingOutcomeStatus.REFUNDED, BookingRevenueFact::getRefundAmount);
        BigDecimal averageOrderValue = confirmedBookings == 0
                ? BigDecimal.ZERO : grossRevenue.divide(BigDecimal.valueOf(confirmedBookings), 2, RoundingMode.HALF_UP);
        BigDecimal refundRate = confirmedBookings == 0
                ? BigDecimal.ZERO : BigDecimal.valueOf(refundCount * 100.0 / confirmedBookings).setScale(2, RoundingMode.HALF_UP);
        Long freshnessSeconds = dataThrough == null ? null : Math.max(0, Duration.between(dataThrough, OffsetDateTime.now()).getSeconds());
        String freshnessStatus = dataThrough == null ? "NO_DATA"
                : freshnessSeconds <= FRESHNESS_WINDOW_SECONDS ? "FRESH" : "STALE";

        return new AdminAnalyticsSummaryResponse(
                confirmedBookings,
                ticketsSold,
                ticketRevenue,
                concessionRevenue,
                grossRevenue,
                refundCount,
                refundAmount,
                grossRevenue.subtract(refundAmount),
                averageOrderValue,
                refundRate,
                CURRENCY,
                dataThrough,
                freshnessSeconds,
                freshnessStatus,
                null);
    }

    private AdminAnalyticsSummaryResponse withPreviousPeriod(
            AdminAnalyticsSummaryResponse current,
            AdminAnalyticsComparisonResponse previousPeriod) {
        return new AdminAnalyticsSummaryResponse(current.confirmedBookings(), current.ticketsSold(), current.ticketRevenue(),
                current.concessionRevenue(), current.grossRevenue(), current.refundCount(), current.refundAmount(),
                current.netRevenue(), current.averageOrderValue(), current.refundRate(), current.currency(),
                current.dataThrough(), current.dataFreshnessSeconds(), current.dataFreshnessStatus(), previousPeriod);
    }

    private AdminAnalyticsComparisonResponse comparison(
            AdminAnalyticsSummaryResponse current,
            AdminAnalyticsSummaryResponse previous,
            LocalDate previousFrom,
            LocalDate previousTo) {
        return new AdminAnalyticsComparisonResponse(
                previousFrom,
                previousTo,
                current.confirmedBookings() - previous.confirmedBookings(),
                changePercent(current.confirmedBookings(), previous.confirmedBookings()),
                current.ticketsSold() - previous.ticketsSold(),
                changePercent(current.ticketsSold(), previous.ticketsSold()),
                current.grossRevenue().subtract(previous.grossRevenue()),
                changePercent(current.grossRevenue(), previous.grossRevenue()),
                current.averageOrderValue().subtract(previous.averageOrderValue()),
                changePercent(current.averageOrderValue(), previous.averageOrderValue()),
                current.refundRate().subtract(previous.refundRate()),
                changePercent(current.refundRate(), previous.refundRate()),
                current.netRevenue().subtract(previous.netRevenue()),
                changePercent(current.netRevenue(), previous.netRevenue()));
    }

    private BigDecimal changePercent(BigDecimal current, BigDecimal previous) {
        if (previous == null || previous.signum() == 0) return null;
        return current.subtract(previous).multiply(BigDecimal.valueOf(100))
                .divide(previous, 2, RoundingMode.HALF_UP);
    }

    private BigDecimal changePercent(long current, long previous) {
        if (previous == 0) return null;
        return BigDecimal.valueOf(current - previous).multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(previous), 2, RoundingMode.HALF_UP);
    }

    private long daySpan(LocalDate from, LocalDate to) {
        validateRange(from, to);
        return java.time.temporal.ChronoUnit.DAYS.between(from, to) + 1;
    }

    private void validateRange(LocalDate from, LocalDate to) {
        if (from == null || to == null || from.isAfter(to)) {
            throw new IllegalArgumentException("from and to are required; from cannot be after to");
        }
    }

    private BigDecimal sum(
            List<BookingRevenueFact> facts,
            BookingOutcomeStatus status,
            java.util.function.Function<BookingRevenueFact, BigDecimal> value) {
        return facts.stream()
                .filter(f -> f.getOutcomeStatus() == status)
                .map(value)
                .filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
