package bookingservice.service;

import bookingservice.dto.response.BookingDetailResponse;
import bookingservice.dto.response.PromotionReservationResponse;
import bookingservice.entity.Booking;
import bookingservice.entity.BookingItem;
import bookingservice.entity.ConcessionItem;
import bookingservice.entity.BookingStatus;
import bookingservice.entity.PaymentStatus;
import bookingservice.entity.PromotionReservation;
import bookingservice.repository.BookingRepository;
import bookingservice.repository.PromotionReservationRepository;
import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;

import static bookingservice.exception.BookingErrorCode.*;

@Service
@RequiredArgsConstructor
public class BookingPromotionCheckoutService {
    private final BookingRepository bookingRepository;
    private final PromotionReservationRepository reservationRepository;
    private final BookingPromotionService promotionService;
    private final BookingResponseMapper responseMapper;
    private final BookingEventService bookingEventService;

    @Transactional
    public BookingDetailResponse apply(
            String bookingId,
            String accountId,
            String idempotencyKey,
            String code) {
        Booking booking = payableBooking(bookingId, accountId);
        String normalizedCode = promotionService.normalize(code);
        if (normalizedCode == null || idempotencyKey == null || idempotencyKey.isBlank()
                || idempotencyKey.length() > 64) {
            throw new AppException(INVALID_REQUEST);
        }
        if (normalizedCode.equals(booking.getPromotionCode())) {
            return responseMapper.toDetail(booking);
        }
        if (booking.getPromotionReservationId() != null) {
            throw new AppException(PROMOTION_ALREADY_APPLIED);
        }

        String reservationKey = "checkout:" + bookingId + ":" + idempotencyKey.trim();
        PromotionReservationResponse reserved = null;
        try {
            reserved = promotionService.reserve(normalizedCode, booking, reservationKey);
            DiscountAllocation allocation = allocate(
                    reserved.benefitScope(),
                    reserved.discountAmount(),
                    ticketSubtotal(booking),
                    concessionSubtotal(booking));
            applySnapshot(booking, normalizedCode, reserved, allocation);
            reservationRepository.save(PromotionReservation.builder()
                    .booking(booking)
                    .promotionId(reserved.promotionId().toString())
                    .promotionCode(normalizedCode)
                    .externalReservationId(reserved.reservationId().toString())
                    .discountAmount(reserved.discountAmount())
                    .benefitScope(reserved.benefitScope())
                    .ticketDiscountAmount(allocation.ticket())
                    .concessionDiscountAmount(allocation.concession())
                    .status(reserved.status())
                    .expiresAt(reserved.expiresAt())
                    .idempotencyKey(reservationKey)
                    .build());
            bookingEventService.append(
                    booking, "PROMOTION_RESERVED", "promotion:" + reserved.reservationId());
            return responseMapper.toDetail(bookingRepository.save(booking));
        } catch (RuntimeException exception) {
            promotionService.releaseQuietly(reserved);
            throw exception;
        }
    }

    @Transactional
    public BookingDetailResponse remove(String bookingId, String accountId) {
        Booking booking = payableBooking(bookingId, accountId);
        if (booking.getPromotionReservationId() == null) {
            return responseMapper.toDetail(booking);
        }
        String reservationId = booking.getPromotionReservationId();
        promotionService.release(reservationId);
        clearSnapshot(booking);
        bookingEventService.append(booking, "PROMOTION_RELEASED", "promotion:" + reservationId);
        return responseMapper.toDetail(bookingRepository.save(booking));
    }

    private Booking payableBooking(String bookingId, String accountId) {
        Booking booking = bookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new AppException(BOOKING_NOT_FOUND));
        if (!booking.getAccountId().equals(accountId)) {
            throw new AppException(BOOKING_FORBIDDEN);
        }
        if (booking.getStatus() != BookingStatus.PENDING_PAYMENT
                || booking.getPaymentStatus() != PaymentStatus.PENDING
                || booking.getPaymentReference() != null
                || !booking.getExpiresAt().isAfter(OffsetDateTime.now())) {
            throw new AppException(PROMOTION_CHANGE_NOT_ALLOWED);
        }
        return booking;
    }

    private void applySnapshot(
            Booking booking,
            String code,
            PromotionReservationResponse reserved,
            DiscountAllocation allocation) {
        booking.setPromotionId(reserved.promotionId().toString());
        booking.setPromotionCode(code);
        booking.setPromotionReservationId(reserved.reservationId().toString());
        booking.setPromotionDiscountAmount(reserved.discountAmount());
        booking.setPromotionCurrency(reserved.currency());
        booking.setPromotionBenefitScope(reserved.benefitScope());
        booking.setTicketPromotionDiscount(allocation.ticket());
        booking.setConcessionPromotionDiscount(allocation.concession());
        booking.setDiscountAmount(reserved.discountAmount());
        recalculateFinalAmount(booking);
    }

    private void clearSnapshot(Booking booking) {
        booking.setPromotionId(null);
        booking.setPromotionCode(null);
        booking.setPromotionReservationId(null);
        booking.setPromotionDiscountAmount(null);
        booking.setPromotionCurrency(null);
        booking.setPromotionBenefitScope(null);
        booking.setTicketPromotionDiscount(BigDecimal.ZERO);
        booking.setConcessionPromotionDiscount(BigDecimal.ZERO);
        booking.setDiscountAmount(BigDecimal.ZERO);
        recalculateFinalAmount(booking);
    }

    private void recalculateFinalAmount(Booking booking) {
        booking.setFinalAmount(booking.getTotalAmount()
                .add(booking.getServiceFeeAmount())
                .subtract(booking.getDiscountAmount())
                .subtract(booking.getPointsDiscount()));
    }

    private DiscountAllocation allocate(
            String scope,
            BigDecimal discount,
            BigDecimal ticketSubtotal,
            BigDecimal concessionSubtotal) {
        if ("TICKETS".equals(scope)) {
            return new DiscountAllocation(discount, BigDecimal.ZERO);
        }
        if ("CONCESSIONS".equals(scope)) {
            return new DiscountAllocation(BigDecimal.ZERO, discount);
        }
        BigDecimal orderSubtotal = ticketSubtotal.add(concessionSubtotal);
        if (orderSubtotal.signum() == 0) {
            return new DiscountAllocation(BigDecimal.ZERO, BigDecimal.ZERO);
        }
        BigDecimal ticketDiscount = discount.multiply(ticketSubtotal)
                .divide(orderSubtotal, 2, RoundingMode.DOWN);
        return new DiscountAllocation(ticketDiscount, discount.subtract(ticketDiscount));
    }

    private BigDecimal ticketSubtotal(Booking booking) {
        return booking.getBookingDetails().stream()
                .map(BookingItem::getFinalPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal concessionSubtotal(Booking booking) {
        return booking.getConcessionItems().stream()
                .map(ConcessionItem::getFinalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private record DiscountAllocation(BigDecimal ticket, BigDecimal concession) {
    }
}
