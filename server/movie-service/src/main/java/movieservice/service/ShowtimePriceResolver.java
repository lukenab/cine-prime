package movieservice.service;

import movie.theater.common.exception.AppException;
import movieservice.entity.CinemaRoom;
import movieservice.entity.Seat;
import movieservice.entity.ShowTime;
import movieservice.enums.SeatStatus;
import movieservice.enums.SeatType;
import movieservice.exception.MovieErrorCode;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Optional;

/**
 * Central pricing rules for showtime inventory.
 *
 * <p>{@link ShowTime#getBasePrice()} is the Standard-seat price for one
 * showtime. When present, the final sellable-unit price is derived from the
 * seat-type multiplier. When it is absent, the explicitly configured master
 * seat price is used. No runtime monetary fallback is allowed.</p>
 */
public final class ShowtimePriceResolver {

    private static final int MONEY_SCALE = 2;

    private ShowtimePriceResolver() {
    }

    public static BigDecimal resolveSeatSnapshotPrice(ShowTime showtime, Seat seat) {
        BigDecimal standardBasePrice = showtime.getBasePrice();
        if (isPositive(standardBasePrice)) {
            SeatType seatType = seat.getSeatType() == null ? SeatType.STANDARD : seat.getSeatType();
            return standardBasePrice
                    .multiply(BigDecimal.valueOf(seatType.getPriceMultiplier()))
                    .setScale(MONEY_SCALE, RoundingMode.HALF_UP);
        }

        if (isPositive(seat.getPrice())) {
            return seat.getPrice().setScale(MONEY_SCALE, RoundingMode.HALF_UP);
        }

        throw new AppException(MovieErrorCode.SHOWTIME_PRICE_NOT_CONFIGURED);
    }

    /**
     * Resolves the Standard-seat base price used by generated schedule plans.
     * Prefer an ACTIVE Standard seat; Accessible has the same multiplier and is
     * a safe fallback for layouts without a Standard zone.
     */
    public static BigDecimal resolveRoomStandardBasePrice(CinemaRoom room) {
        List<Seat> seats = Optional.ofNullable(room.getSeats()).orElseGet(List::of);

        return seats.stream()
                .filter(seat -> seat.getStatus() == SeatStatus.ACTIVE)
                .filter(seat -> seat.getSeatType() == SeatType.STANDARD
                        || seat.getSeatType() == SeatType.ACCESSIBLE)
                .map(Seat::getPrice)
                .filter(ShowtimePriceResolver::isPositive)
                .min(BigDecimal::compareTo)
                .map(price -> price.setScale(MONEY_SCALE, RoundingMode.HALF_UP))
                .orElseThrow(() -> new AppException(MovieErrorCode.SHOWTIME_PRICE_NOT_CONFIGURED));
    }

    private static boolean isPositive(BigDecimal value) {
        return value != null && value.signum() > 0;
    }
}
