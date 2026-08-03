package bookingservice.service;

import bookingservice.client.MemberClient;
import bookingservice.client.PromotionClient;
import bookingservice.client.ShowtimeClient;
import bookingservice.dto.request.BookingRequest;
import bookingservice.dto.request.CreateBookingQuoteRequest;
import bookingservice.dto.request.PromotionQuoteRequest;
import bookingservice.dto.response.CreateBookingResponse;
import bookingservice.dto.response.HeldShowtimeSeatResponse;
import bookingservice.dto.response.MovieSeatHoldResponse;
import bookingservice.dto.response.MovieSeatMapResponse;
import bookingservice.dto.response.SeatAvailabilityResponse;
import bookingservice.dto.response.BookingQuoteResponse;
import bookingservice.dto.response.PromotionQuoteResponse;
import bookingservice.dto.response.PromotionReservationResponse;
import bookingservice.entity.Booking;
import bookingservice.entity.BookingStatus;
import bookingservice.mapper.BookingMapper;
import bookingservice.repository.BookingItemRepository;
import bookingservice.repository.BookingRepository;
import bookingservice.repository.BookingQuoteRepository;
import bookingservice.repository.SeatLockRepository;
import bookingservice.repository.TicketRepository;
import movie.theater.common.dto.ApiResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingServicePromotionTest {

    @Mock BookingRepository bookingRepository;
    @Mock BookingQuoteRepository bookingQuoteRepository;
    @Mock BookingItemRepository bookingItemRepository;
    @Mock SeatLockRepository seatLockRepository;
    @Mock TicketRepository ticketRepository;
    @Mock ShowtimeClient showtimeClient;
    @Mock PromotionClient promotionClient;
    @Mock BookingMapper bookingMapper;
    @Mock MemberClient memberClient;

    @InjectMocks BookingService service;

    @Test
    void createBooking_usesMovieIdFromAuthoritativeSeatHoldAndStoresPromotionSnapshot() {
        MovieSeatHoldResponse seatHold = new MovieSeatHoldResponse();
        seatHold.setHoldId("hold-001");
        seatHold.setShowtimeId(55L);
        seatHold.setMovieId(12L);
        seatHold.setClusterId(7L);
        seatHold.setExpiresAt(LocalDateTime.now().plusMinutes(10));
        HeldShowtimeSeatResponse seat = new HeldShowtimeSeatResponse();
        seat.setSeatId(901L);
        seat.setSeatCode("G7");
        seat.setPrice(new BigDecimal("120000"));
        seatHold.setSeats(List.of(seat));

        when(showtimeClient.holdSeats(eq(55L), eq("checkout-001"), any()))
                .thenReturn(ApiResponse.<MovieSeatHoldResponse>builder().result(seatHold).build());
        when(bookingRepository.findBySeatHoldId("hold-001")).thenReturn(Optional.empty());
        when(promotionClient.quote(any())).thenReturn(ApiResponse.<PromotionQuoteResponse>builder()
                .result(new PromotionQuoteResponse(true, null, UUID.randomUUID(),
                        new BigDecimal("120000"), new BigDecimal("24000"),
                        new BigDecimal("96000"), "VND"))
                .build());
        UUID reservationId = UUID.randomUUID();
        UUID promotionId = UUID.randomUUID();
        when(promotionClient.reserve(any())).thenReturn(ApiResponse.<PromotionReservationResponse>builder()
                .result(new PromotionReservationResponse(reservationId, promotionId, "ignored", "member-01", "RESERVED",
                        new BigDecimal("120000"), new BigDecimal("24000"), new BigDecimal("96000"), "VND",
                        OffsetDateTime.now().plusMinutes(15)))
                .build());
        when(bookingRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(bookingMapper.toCreateBookingResponse(any(), any(), any())).thenReturn(new CreateBookingResponse());

        BookingRequest request = new BookingRequest(55L, List.of(901L), 0, "summer26");
        service.createBookingAndHoldSeats(request, "member-01", true, "checkout-001");

        ArgumentCaptor<PromotionQuoteRequest> quoteCaptor = ArgumentCaptor.forClass(PromotionQuoteRequest.class);
        org.mockito.Mockito.verify(promotionClient).quote(quoteCaptor.capture());
        assertThat(quoteCaptor.getValue().movieId()).isEqualTo(12L);
        assertThat(quoteCaptor.getValue().showtimeId()).isEqualTo(55L);
        assertThat(quoteCaptor.getValue().subtotalAmount()).isEqualByComparingTo("120000");
        assertThat(quoteCaptor.getValue().bookingId()).isEqualTo(
                UUID.nameUUIDFromBytes("member-01:checkout-001".getBytes(StandardCharsets.UTF_8)).toString());

        ArgumentCaptor<Booking> bookingCaptor = ArgumentCaptor.forClass(Booking.class);
        org.mockito.Mockito.verify(bookingRepository).save(bookingCaptor.capture());
        assertThat(bookingCaptor.getValue().getPromotionId()).isEqualTo(promotionId.toString());
        assertThat(bookingCaptor.getValue().getPromotionReservationId()).isEqualTo(reservationId.toString());
        assertThat(bookingCaptor.getValue().getPromotionDiscountAmount()).isEqualByComparingTo("24000");
        assertThat(bookingCaptor.getValue().getFinalAmount()).isEqualByComparingTo("96000");
    }

    @Test
    void createQuote_usesMovieSeatMapInsteadOfClientPriceAndDoesNotReserveQuota() {
        SeatAvailabilityResponse seat = SeatAvailabilityResponse.builder()
                .seatId(901L).seatCode("G7").price(new BigDecimal("120000")).status("AVAILABLE").build();
        when(showtimeClient.getSeatMap(55L)).thenReturn(ApiResponse.<MovieSeatMapResponse>builder()
                .result(new MovieSeatMapResponse(12L, 7L, List.of(seat))).build());
        when(bookingQuoteRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        BookingQuoteResponse quote = service.createCheckoutQuote(
                new CreateBookingQuoteRequest(55L, List.of(901L), null), "member-01", true);

        assertThat(quote.subTotal()).isEqualByComparingTo("120000");
        assertThat(quote.discountAmount()).isEqualByComparingTo("0");
        assertThat(quote.finalAmount()).isEqualByComparingTo("120000");
        org.mockito.Mockito.verifyNoInteractions(promotionClient);
        org.mockito.Mockito.verify(bookingQuoteRepository).save(any());
    }

    @Test
    void confirmBooking_commitsPromotionReservationBeforeChangingStatus() {
        String bookingId = "booking-confirm-001";
        UUID reservationId = UUID.randomUUID();
        Booking booking = Booking.builder().bookingId(bookingId).accountId("member-01")
                .status(BookingStatus.PENDING.name()).promotionReservationId(reservationId.toString())
                .expiresAt(LocalDateTime.now().plusMinutes(5)).build();
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(booking)).thenReturn(booking);
        when(bookingItemRepository.findByBooking_BookingId(bookingId)).thenReturn(List.of());
        when(bookingMapper.toCreateBookingResponse(any(), any(), any())).thenReturn(new CreateBookingResponse());

        service.confirmBooking(bookingId, true);

        org.mockito.Mockito.verify(promotionClient).commit(reservationId);
        assertThat(booking.getStatus()).isEqualTo(BookingStatus.CONFIRMED.name());
    }

    @Test
    void expirePendingBooking_releasesPromotionReservation() {
        UUID reservationId = UUID.randomUUID();
        Booking booking = Booking.builder().bookingId("booking-expired-001").status(BookingStatus.PENDING.name())
                .promotionReservationId(reservationId.toString()).expiresAt(LocalDateTime.now().minusMinutes(1)).build();
        when(bookingRepository.findById("booking-expired-001")).thenReturn(Optional.of(booking));

        service.expirePendingBooking("booking-expired-001");

        org.mockito.Mockito.verify(promotionClient).release(reservationId);
        assertThat(booking.getStatus()).isEqualTo(BookingStatus.EXPIRED.name());
    }
}
