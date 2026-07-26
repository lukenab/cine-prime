package movieservice.service;

import movie.theater.common.exception.AppException;
import movieservice.entity.CinemaRoom;
import movieservice.entity.Seat;
import movieservice.entity.ShowTime;
import movieservice.enums.SeatStatus;
import movieservice.enums.SeatType;
import movieservice.exception.MovieErrorCode;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ShowtimePriceResolverTest {

    @Test
    void derivesFinalSnapshotFromStandardBaseAndSeatType() {
        ShowTime showtime = ShowTime.builder()
                .basePrice(new BigDecimal("100000.00"))
                .build();

        assertEquals(new BigDecimal("100000.00"),
                ShowtimePriceResolver.resolveSeatSnapshotPrice(showtime, seat(SeatType.STANDARD, null)));
        assertEquals(new BigDecimal("125000.00"),
                ShowtimePriceResolver.resolveSeatSnapshotPrice(showtime, seat(SeatType.VIP, null)));
        assertEquals(new BigDecimal("180000.00"),
                ShowtimePriceResolver.resolveSeatSnapshotPrice(showtime, seat(SeatType.COUPLE, null)));
        assertEquals(new BigDecimal("100000.00"),
                ShowtimePriceResolver.resolveSeatSnapshotPrice(showtime, seat(SeatType.ACCESSIBLE, null)));
    }

    @Test
    void usesConfiguredMasterSeatPriceWhenShowtimeHasNoOverride() {
        BigDecimal result = ShowtimePriceResolver.resolveSeatSnapshotPrice(
                ShowTime.builder().build(),
                seat(SeatType.VIP, new BigDecimal("145000")));

        assertEquals(new BigDecimal("145000.00"), result);
    }

    @Test
    void rejectsMissingPriceInsteadOfUsingHardcodedFallback() {
        AppException exception = assertThrows(
                AppException.class,
                () -> ShowtimePriceResolver.resolveSeatSnapshotPrice(
                        ShowTime.builder().build(), seat(SeatType.STANDARD, null)));

        assertEquals(MovieErrorCode.SHOWTIME_PRICE_NOT_CONFIGURED, exception.getErrorCode());
    }

    @Test
    void generatedShowtimeUsesConfiguredActiveStandardSeatPrice() {
        CinemaRoom room = CinemaRoom.builder()
                .seats(List.of(
                        seat(SeatType.VIP, new BigDecimal("130000")),
                        seat(SeatType.STANDARD, new BigDecimal("100000")),
                        seat(SeatType.ACCESSIBLE, new BigDecimal("100000"))))
                .build();

        assertEquals(new BigDecimal("100000.00"),
                ShowtimePriceResolver.resolveRoomStandardBasePrice(room));
    }

    private Seat seat(SeatType type, BigDecimal price) {
        return Seat.builder()
                .seatType(type)
                .status(SeatStatus.ACTIVE)
                .price(price)
                .build();
    }
}
