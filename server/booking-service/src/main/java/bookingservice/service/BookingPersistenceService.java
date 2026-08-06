package bookingservice.service;

import bookingservice.dto.response.HeldShowtimeSeatResponse;
import bookingservice.dto.response.MovieSeatHoldResponse;
import bookingservice.dto.response.MovieShowtimeResponse;
import bookingservice.dto.response.PromotionReservationResponse;
import bookingservice.entity.*;
import bookingservice.repository.BookingRepository;
import bookingservice.repository.IdempotencyRecordRepository;
import bookingservice.repository.PromotionReservationRepository;
import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

import static bookingservice.exception.BookingErrorCode.SERVICE_UNAVAILABLE;
import static bookingservice.service.BookingIdempotencyService.CREATE_BOOKING;

@Service
@RequiredArgsConstructor
public class BookingPersistenceService {
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final BookingRepository bookingRepository;
    private final IdempotencyRecordRepository idempotencyRepository;
    private final PromotionReservationRepository promotionReservationRepository;
    private final BookingEventService bookingEventService;

    @Transactional
    public Booking create(
            String accountId,
            MovieShowtimeResponse showtime,
            MovieSeatHoldResponse hold,
            String idempotencyKey,
            String correlationId,
            String bookingId,
            String promotionCode,
            PromotionReservationResponse promotion) {
        return create(
                accountId,
                showtime,
                hold,
                idempotencyKey,
                correlationId,
                bookingId,
                promotionCode,
                promotion,
                BookingType.ONLINE,
                CREATE_BOOKING,
                true);
    }

    @Transactional
    public Booking createCounter(
            String accountId,
            MovieShowtimeResponse showtime,
            MovieSeatHoldResponse hold,
            String idempotencyKey,
            String correlationId) {
        return create(
                accountId,
                showtime,
                hold,
                idempotencyKey,
                correlationId,
                UUID.randomUUID().toString(),
                null,
                null,
                BookingType.COUNTER,
                BookingIdempotencyService.CREATE_COUNTER_BOOKING,
                false);
    }

    private Booking create(
            String accountId,
            MovieShowtimeResponse showtime,
            MovieSeatHoldResponse hold,
            String idempotencyKey,
            String correlationId,
            String bookingId,
            String promotionCode,
            PromotionReservationResponse promotion,
            BookingType bookingType,
            String operationScope,
            boolean completeIdempotencyOperation) {
        BigDecimal subtotal = hold.getSeats().stream()
                .map(HeldShowtimeSeatResponse::getPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (hold.getTotalPrice() != null && subtotal.compareTo(hold.getTotalPrice()) != 0) {
            throw new AppException(SERVICE_UNAVAILABLE);
        }

        OffsetDateTime expiresAt = hold.getExpiresAt();
        if (expiresAt == null) {
            throw new AppException(SERVICE_UNAVAILABLE);
        }
        BigDecimal promotionDiscount = promotion == null
                ? BigDecimal.ZERO : promotion.discountAmount();
        BigDecimal finalAmount = subtotal.subtract(promotionDiscount);
        Booking booking = Booking.builder()
                .bookingId(bookingId)
                .bookingCode(newBookingCode())
                .bookingType(bookingType)
                .accountId(accountId)
                .showtimeId(showtime.getShowTimeId())
                .movieId(showtime.getMovieId())
                .movieName(showtime.getMovieName())
                .clusterId(showtime.getClusterId())
                .clusterName(showtime.getClusterName())
                .cinemaRoomId(showtime.getCinemaRoomId())
                .cinemaRoomName(showtime.getCinemaRoomName())
                .showDate(showtime.getShowDate())
                .startTime(showtime.getStartTime())
                .showtimeTimezone(BUSINESS_ZONE.getId())
                .holdReference(hold.getHoldId())
                .totalAmount(subtotal)
                .discountAmount(promotionDiscount)
                .finalAmount(finalAmount)
                .promotionId(promotion == null || promotion.promotionId() == null
                        ? null : promotion.promotionId().toString())
                .promotionCode(promotion == null ? null : promotionCode)
                .promotionReservationId(promotion == null || promotion.reservationId() == null
                        ? null : promotion.reservationId().toString())
                .promotionBenefitScope(promotion == null ? null : promotion.benefitScope())
                .promotionDiscountAmount(promotion == null ? null : promotion.discountAmount())
                .ticketPromotionDiscount(promotionDiscount)
                .concessionPromotionDiscount(BigDecimal.ZERO)
                .promotionCurrency(promotion == null ? null : promotion.currency())
                .status(BookingStatus.PENDING_PAYMENT)
                .paymentStatus(PaymentStatus.PENDING)
                .inventoryStatus(InventoryStatus.HELD)
                .expiresAt(expiresAt)
                .createdBy(accountId)
                .build();

        List<BookingItem> items = hold.getSeats().stream()
                .map(seat -> BookingItem.builder()
                        .booking(booking)
                        .showtimeSeatId(seat.getSeatId())
                        .seatCode(seat.getSeatCode())
                        .seatType(seat.getSeatType())
                        .unitPrice(seat.getPrice())
                        .finalPrice(seat.getPrice())
                        .build())
                .toList();
        booking.getBookingDetails().addAll(items);

        InventoryReservation reservation = InventoryReservation.builder()
                .booking(booking)
                .externalHoldId(hold.getHoldId())
                .holdToken(UUID.randomUUID().toString())
                .status(InventoryStatus.HELD)
                .expiresAt(expiresAt)
                .build();
        booking.setInventoryReservation(reservation);
        Booking saved = bookingRepository.save(booking);

        if (promotion != null) {
            promotionReservationRepository.save(PromotionReservation.builder()
                    .booking(saved)
                    .promotionId(promotion.promotionId().toString())
                    .promotionCode(promotionCode)
                    .externalReservationId(promotion.reservationId().toString())
                    .discountAmount(promotion.discountAmount())
                    .benefitScope(promotion.benefitScope())
                    .ticketDiscountAmount(promotion.discountAmount())
                    .concessionDiscountAmount(BigDecimal.ZERO)
                    .status(promotion.status())
                    .expiresAt(promotion.expiresAt())
                    .idempotencyKey("booking-promotion:" + bookingId)
                    .build());
        }

        IdempotencyRecord operation = idempotencyRepository
                .findByCallerScopeAndOperationScopeAndIdempotencyKey(accountId, operationScope, idempotencyKey)
                .orElseThrow(() -> new AppException(SERVICE_UNAVAILABLE));
        operation.setBooking(saved);
        if (completeIdempotencyOperation) {
            operation.setStatus(OperationStatus.SUCCEEDED);
            operation.setHttpStatus(201);
        }
        idempotencyRepository.save(operation);

        bookingEventService.append(saved, "BOOKING_PENDING_PAYMENT", correlationId);
        return saved;
    }

    private String newBookingCode() {
        String timestamp = OffsetDateTime.now(BUSINESS_ZONE)
                .format(DateTimeFormatter.ofPattern("yyMMddHHmmss"));
        String suffix = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        return "CP" + timestamp + suffix;
    }
}
