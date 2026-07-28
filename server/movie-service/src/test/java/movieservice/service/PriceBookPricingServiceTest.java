package movieservice.service;

import movieservice.entity.CinemaCluster;
import movieservice.entity.CinemaRoom;
import movieservice.entity.PriceBook;
import movieservice.entity.PriceRate;
import movieservice.entity.ScreeningFormat;
import movieservice.entity.Seat;
import movieservice.entity.ShowTime;
import movieservice.enums.PriceBookStatus;
import movieservice.enums.PriceRateDayType;
import movieservice.enums.SeatStatus;
import movieservice.enums.SeatType;
import movieservice.enums.ShowtimePriceSource;
import movieservice.repository.PriceBookRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PriceBookPricingServiceTest {

    @Mock
    PriceBookRepository priceBookRepository;

    @InjectMocks
    PriceBookPricingService service;

    @Test
    void explicitShowtimeOverrideWinsWithoutPriceBookLookup() {
        ShowTime showtime = ShowTime.builder()
                .priceSource(ShowtimePriceSource.SHOWTIME_OVERRIDE)
                .basePrice(new BigDecimal("110000"))
                .build();

        PriceBookPricingService.PricingDecision decision = service.resolve(showtime);

        assertEquals(ShowtimePriceSource.SHOWTIME_OVERRIDE, decision.source());
        assertEquals(new BigDecimal("110000.00"), decision.standardPrice());
        assertEquals(new BigDecimal("137500.00"),
                decision.priceFor(seat(SeatType.VIP, null)));
        verify(priceBookRepository, never()).findEffectiveBooks(
                org.mockito.ArgumentMatchers.anyLong(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any());
    }

    @Test
    void selectsSpecificWeekendFormatRateAndAppliesConfiguredMultipliers() {
        LocalDate saturday = LocalDate.of(2026, 7, 25);
        ScreeningFormat imax = ScreeningFormat.builder()
                .formatId(3)
                .formatCode("IMAX")
                .build();
        CinemaRoom room = room();
        PriceBook book = PriceBook.builder()
                .priceBookId(8L)
                .cluster(room.getCluster())
                .status(PriceBookStatus.ACTIVE)
                .priority(10)
                .build();
        PriceRate generic = rate(1L, PriceRateDayType.ALL_DAYS, null, "90000", 1);
        PriceRate specific = rate(2L, PriceRateDayType.WEEKEND, imax, "140000", 20);
        generic.setPriceBook(book);
        specific.setPriceBook(book);
        book.setRates(List.of(generic, specific));

        when(priceBookRepository.findEffectiveBooks(
                43L, PriceBookStatus.ACTIVE, saturday))
                .thenReturn(List.of(book));

        PriceBookPricingService.PricingDecision decision =
                service.resolveForSlot(room, saturday, LocalTime.of(19, 30), imax);

        assertEquals(ShowtimePriceSource.PRICE_BOOK, decision.source());
        assertEquals(2L, decision.priceRate().getPriceRateId());
        assertEquals(new BigDecimal("140000.00"), decision.standardPrice());
        assertEquals(new BigDecimal("210000.00"),
                decision.priceFor(seat(SeatType.VIP, null)));
    }

    @Test
    void fallsBackToConfiguredRoomSeatPricesWhenNoRateMatches() {
        CinemaRoom room = room();
        when(priceBookRepository.findEffectiveBooks(
                43L, PriceBookStatus.ACTIVE, LocalDate.of(2026, 7, 27)))
                .thenReturn(List.of());

        PriceBookPricingService.PricingDecision decision = service.resolveForSlot(
                room,
                LocalDate.of(2026, 7, 27),
                LocalTime.of(10, 0),
                null);

        assertEquals(ShowtimePriceSource.ROOM_DEFAULT, decision.source());
        assertEquals(new BigDecimal("90000.00"), decision.standardPrice());
        assertEquals(new BigDecimal("135000.00"),
                decision.priceFor(seat(SeatType.VIP, new BigDecimal("135000"))));
    }

    private CinemaRoom room() {
        CinemaCluster cluster = CinemaCluster.builder()
                .clusterId(43L)
                .clusterName("CinePrime Landmark 81")
                .build();
        Seat standard = seat(SeatType.STANDARD, new BigDecimal("90000"));
        Seat vip = seat(SeatType.VIP, new BigDecimal("135000"));
        return CinemaRoom.builder()
                .cinemaRoomId(3L)
                .cluster(cluster)
                .seats(List.of(standard, vip))
                .build();
    }

    private PriceRate rate(
            Long id,
            PriceRateDayType dayType,
            ScreeningFormat format,
            String price,
            int priority) {
        return PriceRate.builder()
                .priceRateId(id)
                .name("Rate " + id)
                .dayType(dayType)
                .startTime(LocalTime.of(18, 0))
                .endTime(LocalTime.of(23, 0))
                .format(format)
                .standardPrice(new BigDecimal(price))
                .vipMultiplier(new BigDecimal("1.500"))
                .coupleMultiplier(new BigDecimal("2.000"))
                .accessibleMultiplier(BigDecimal.ONE)
                .priority(priority)
                .active(true)
                .build();
    }

    private Seat seat(SeatType type, BigDecimal price) {
        return Seat.builder()
                .seatType(type)
                .status(SeatStatus.ACTIVE)
                .price(price)
                .build();
    }
}
