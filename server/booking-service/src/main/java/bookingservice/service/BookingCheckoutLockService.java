package bookingservice.service;

import bookingservice.dto.response.BookingDetailResponse;
import bookingservice.entity.Booking;
import bookingservice.entity.BookingStatus;
import bookingservice.entity.PaymentStatus;
import bookingservice.repository.BookingRepository;
import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

import static bookingservice.exception.BookingErrorCode.*;

/** Freezes checkout pricing before Payment Service snapshots the payable amount. */
@Service
@RequiredArgsConstructor
public class BookingCheckoutLockService {
    private final BookingRepository bookingRepository;
    private final BookingResponseMapper responseMapper;
    private final BookingEventService bookingEventService;

    @Transactional
    public BookingDetailResponse lock(String bookingId, String accountId) {
        Booking booking = bookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new AppException(BOOKING_NOT_FOUND));
        if (!booking.getAccountId().equals(accountId)) {
            throw new AppException(BOOKING_FORBIDDEN);
        }
        if (booking.getStatus() != BookingStatus.PENDING_PAYMENT
                || !booking.getExpiresAt().isAfter(OffsetDateTime.now())
                || booking.getPaymentStatus() == PaymentStatus.SUCCEEDED
                || booking.getPaymentStatus() == PaymentStatus.FAILED
                || booking.getPaymentStatus() == PaymentStatus.CANCELLED) {
            throw new AppException(BOOKING_NOT_PAYABLE);
        }
        if (booking.getPaymentStatus() == PaymentStatus.PENDING) {
            booking.setPaymentStatus(PaymentStatus.PROCESSING);
            bookingEventService.append(booking, "CHECKOUT_PRICE_LOCKED", "checkout:" + bookingId);
            bookingRepository.save(booking);
        }
        return responseMapper.toDetail(booking);
    }
}
