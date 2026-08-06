package bookingservice.service;

import bookingservice.dto.response.BookingDetailResponse;
import bookingservice.dto.response.PromotionReservationResponse;
import bookingservice.entity.*;
import bookingservice.repository.BookingRepository;
import bookingservice.repository.PromotionReservationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class BookingPromotionCheckoutServiceTest {
    private BookingRepository bookings;
    private PromotionReservationRepository reservations;
    private BookingPromotionService promotions;
    private BookingPromotionCheckoutService service;

    @BeforeEach
    void setUp() {
        bookings = mock(BookingRepository.class);
        reservations = mock(PromotionReservationRepository.class);
        promotions = mock(BookingPromotionService.class);
        service = new BookingPromotionCheckoutService(
                bookings,
                reservations,
                promotions,
                new BookingResponseMapper(),
                mock(BookingEventService.class));
        when(bookings.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void appliesOrderPromotionAndPersistsDeterministicAllocation() {
        Booking booking = pendingBooking();
        when(bookings.findByIdForUpdate("booking-1")).thenReturn(Optional.of(booking));
        when(promotions.normalize("cineprime10")).thenReturn("CINEPRIME10");
        when(promotions.reserve(eq("CINEPRIME10"), eq(booking), anyString()))
                .thenReturn(new PromotionReservationResponse(
                        UUID.randomUUID(), UUID.randomUUID(), "booking-1", "account-1",
                        "RESERVED", "ORDER", new BigDecimal("150000"),
                        new BigDecimal("30000"), new BigDecimal("120000"), "VND",
                        OffsetDateTime.now().plusMinutes(10)));

        BookingDetailResponse result = service.apply(
                "booking-1", "account-1", UUID.randomUUID().toString(), "cineprime10");

        assertEquals(new BigDecimal("20000.00"), result.getTicketPromotionDiscount());
        assertEquals(new BigDecimal("10000.00"), result.getConcessionPromotionDiscount());
        assertEquals(new BigDecimal("120000"), result.getTotal());
        assertEquals("ORDER", result.getPromotionBenefitScope());
        verify(reservations).save(any(PromotionReservation.class));
    }

    @Test
    void removeReleasesQuotaAndRestoresTotal() {
        Booking booking = pendingBooking();
        booking.setPromotionCode("CINEPRIME10");
        booking.setPromotionReservationId(UUID.randomUUID().toString());
        booking.setPromotionDiscountAmount(new BigDecimal("30000"));
        booking.setPromotionBenefitScope("ORDER");
        booking.setTicketPromotionDiscount(new BigDecimal("20000"));
        booking.setConcessionPromotionDiscount(new BigDecimal("10000"));
        booking.setDiscountAmount(new BigDecimal("30000"));
        booking.setFinalAmount(new BigDecimal("120000"));
        when(bookings.findByIdForUpdate("booking-1")).thenReturn(Optional.of(booking));

        BookingDetailResponse result = service.remove("booking-1", "account-1");

        verify(promotions).release(anyString());
        assertEquals(new BigDecimal("150000"), result.getTotal());
        assertEquals(BigDecimal.ZERO, result.getTicketPromotionDiscount());
        assertEquals(null, result.getPromotionCode());
    }

    private Booking pendingBooking() {
        Booking booking = Booking.builder()
                .bookingId("booking-1")
                .bookingCode("CP-1")
                .accountId("account-1")
                .showtimeId(10L)
                .movieId(20L)
                .movieName("Movie")
                .clusterId(30L)
                .clusterName("Cinema")
                .cinemaRoomId(40L)
                .cinemaRoomName("Room 1")
                .showDate(java.time.LocalDate.now())
                .startTime(java.time.LocalTime.NOON)
                .showtimeTimezone("Asia/Ho_Chi_Minh")
                .holdReference("hold-1")
                .totalAmount(new BigDecimal("150000"))
                .finalAmount(new BigDecimal("150000"))
                .status(BookingStatus.PENDING_PAYMENT)
                .paymentStatus(PaymentStatus.PENDING)
                .inventoryStatus(InventoryStatus.HELD)
                .expiresAt(OffsetDateTime.now().plusMinutes(10))
                .build();
        booking.getBookingDetails().add(BookingItem.builder()
                .booking(booking).showtimeSeatId(1L).seatCode("A1").seatType("STANDARD")
                .unitPrice(new BigDecimal("100000")).finalPrice(new BigDecimal("100000")).build());
        booking.getConcessionItems().add(ConcessionItem.builder()
                .booking(booking).sku("COMBO").itemName("Combo").quantity(1)
                .unitPrice(new BigDecimal("50000")).discountAmount(BigDecimal.ZERO)
                .finalAmount(new BigDecimal("50000")).fulfillmentClusterId(30L)
                .status("RESERVED").idempotencyKey("food-1").build());
        return booking;
    }
}
