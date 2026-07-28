package movieservice.service;

import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import movieservice.entity.CinemaRoom;
import movieservice.entity.PriceBook;
import movieservice.entity.PriceRate;
import movieservice.entity.ScreeningFormat;
import movieservice.entity.Seat;
import movieservice.entity.ShowTime;
import movieservice.enums.PriceBookStatus;
import movieservice.enums.PriceRateDayType;
import movieservice.enums.SeatType;
import movieservice.enums.ShowtimePriceSource;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.PriceBookRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.List;

/**
 * Resolves commercial ticket pricing before showtime inventory is materialized.
 *
 * <p>Precedence: explicit showtime override, effective cluster Price Book,
 * then the room's configured master-seat prices. The selected result is copied
 * to show_time for traceability and to showtime_seat as the final sales
 * snapshot.</p>
 */
@Service
@RequiredArgsConstructor
public class PriceBookPricingService {

    private static final int MONEY_SCALE = 2;

    private final PriceBookRepository priceBookRepository;

    @Transactional(readOnly = true)
    public PricingDecision resolve(ShowTime showtime) {
        if (showtime.getPriceSource() == ShowtimePriceSource.SHOWTIME_OVERRIDE
                && isPositive(showtime.getBasePrice())) {
            return PricingDecision.override(showtime.getBasePrice());
        }
        return resolveForSlot(
                showtime.getCinemaRoom(),
                showtime.getShowDate(),
                showtime.getStartTime(),
                showtime.getFormat());
    }

    @Transactional(readOnly = true)
    public PricingDecision resolveForSlot(
            CinemaRoom room,
            LocalDate businessDate,
            LocalTime startTime,
            ScreeningFormat format) {
        List<PriceBook> books = priceBookRepository.findEffectiveBooks(
                room.getCluster().getClusterId(),
                PriceBookStatus.ACTIVE,
                businessDate);

        for (PriceBook book : books) {
            PriceRate rate = book.getRates().stream()
                    .filter(candidate -> Boolean.TRUE.equals(candidate.getActive()))
                    .filter(candidate -> matchesDay(candidate, businessDate))
                    .filter(candidate -> matchesTime(candidate, startTime))
                    .filter(candidate -> matchesFormat(candidate, format))
                    .max(rateSpecificityComparator())
                    .orElse(null);
            if (rate != null) {
                return PricingDecision.priceBook(book, rate);
            }
        }

        return PricingDecision.roomDefault(
                ShowtimePriceResolver.resolveRoomStandardBasePrice(room));
    }

    public void applyDecision(ShowTime showtime, PricingDecision decision) {
        showtime.setBasePrice(decision.standardPrice());
        showtime.setPriceSource(decision.source());
        showtime.setPriceBook(decision.priceBook());
        showtime.setPriceRate(decision.priceRate());
    }

    private boolean matchesDay(PriceRate rate, LocalDate date) {
        if (rate.getDayType() == PriceRateDayType.ALL_DAYS) {
            return true;
        }
        boolean weekend = date.getDayOfWeek() == DayOfWeek.SATURDAY
                || date.getDayOfWeek() == DayOfWeek.SUNDAY;
        return rate.getDayType() == PriceRateDayType.WEEKEND ? weekend : !weekend;
    }

    private boolean matchesTime(PriceRate rate, LocalTime time) {
        LocalTime start = rate.getStartTime();
        LocalTime end = rate.getEndTime();
        if (end.isAfter(start)) {
            return !time.isBefore(start) && time.isBefore(end);
        }
        return !time.isBefore(start) || time.isBefore(end);
    }

    private boolean matchesFormat(PriceRate rate, ScreeningFormat format) {
        return rate.getFormat() == null
                || (format != null && rate.getFormat().getFormatId().equals(format.getFormatId()));
    }

    private Comparator<PriceRate> rateSpecificityComparator() {
        return Comparator.comparing(PriceRate::getPriority)
                .thenComparing(rate -> rate.getFormat() == null ? 0 : 1)
                .thenComparing(rate -> rate.getDayType() == PriceRateDayType.ALL_DAYS ? 0 : 1)
                .thenComparing(PriceRate::getPriceRateId,
                        Comparator.nullsFirst(Comparator.naturalOrder()));
    }

    private static boolean isPositive(BigDecimal value) {
        return value != null && value.signum() > 0;
    }

    public record PricingDecision(
            BigDecimal standardPrice,
            BigDecimal vipMultiplier,
            BigDecimal coupleMultiplier,
            BigDecimal accessibleMultiplier,
            ShowtimePriceSource source,
            PriceBook priceBook,
            PriceRate priceRate) {

        static PricingDecision override(BigDecimal standardPrice) {
            return new PricingDecision(
                    money(standardPrice),
                    BigDecimal.valueOf(SeatType.VIP.getPriceMultiplier()),
                    BigDecimal.valueOf(SeatType.COUPLE.getPriceMultiplier()),
                    BigDecimal.valueOf(SeatType.ACCESSIBLE.getPriceMultiplier()),
                    ShowtimePriceSource.SHOWTIME_OVERRIDE,
                    null,
                    null);
        }

        static PricingDecision priceBook(PriceBook book, PriceRate rate) {
            return new PricingDecision(
                    money(rate.getStandardPrice()),
                    rate.getVipMultiplier(),
                    rate.getCoupleMultiplier(),
                    rate.getAccessibleMultiplier(),
                    ShowtimePriceSource.PRICE_BOOK,
                    book,
                    rate);
        }

        static PricingDecision roomDefault(BigDecimal standardPrice) {
            return new PricingDecision(
                    money(standardPrice),
                    BigDecimal.valueOf(SeatType.VIP.getPriceMultiplier()),
                    BigDecimal.valueOf(SeatType.COUPLE.getPriceMultiplier()),
                    BigDecimal.valueOf(SeatType.ACCESSIBLE.getPriceMultiplier()),
                    ShowtimePriceSource.ROOM_DEFAULT,
                    null,
                    null);
        }

        public BigDecimal priceFor(Seat seat) {
            if (source == ShowtimePriceSource.ROOM_DEFAULT && isPositive(seat.getPrice())) {
                return money(seat.getPrice());
            }
            SeatType type = seat.getSeatType() == null ? SeatType.STANDARD : seat.getSeatType();
            BigDecimal multiplier = switch (type) {
                case VIP -> vipMultiplier;
                case COUPLE -> coupleMultiplier;
                case ACCESSIBLE -> accessibleMultiplier;
                default -> BigDecimal.ONE;
            };
            if (!isPositive(standardPrice) || !isPositive(multiplier)) {
                throw new AppException(MovieErrorCode.SHOWTIME_PRICE_NOT_CONFIGURED);
            }
            return money(standardPrice.multiply(multiplier));
        }

        private static BigDecimal money(BigDecimal value) {
            return value == null ? null : value.setScale(MONEY_SCALE, RoundingMode.HALF_UP);
        }
    }
}
