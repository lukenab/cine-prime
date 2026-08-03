package bookingservice.service;

import bookingservice.dto.response.BookingDetailResponse;
import bookingservice.entity.Booking;
import bookingservice.repository.BookingRepository;
import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import static bookingservice.exception.BookingErrorCode.BOOKING_FORBIDDEN;
import static bookingservice.exception.BookingErrorCode.BOOKING_NOT_FOUND;

@Service
@RequiredArgsConstructor
public class BookingQueryService {
    private final BookingRepository bookingRepository;
    private final BookingResponseMapper responseMapper;

    @Transactional(readOnly = true)
    public BookingDetailResponse getOwnedBooking(String bookingId, String accountId) {
        Booking booking = bookingRepository.findDetailedByBookingId(bookingId)
                .orElseThrow(() -> new AppException(BOOKING_NOT_FOUND));
        if (!booking.getAccountId().equals(accountId)) {
            throw new AppException(BOOKING_FORBIDDEN);
        }
        return responseMapper.toDetail(booking);
    }

    @Transactional(readOnly = true)
    public Page<BookingDetailResponse> getOwnedBookings(String accountId, Pageable pageable) {
        return bookingRepository.findByAccountIdOrderByCreatedAtDesc(accountId, pageable)
                .map(responseMapper::toDetail);
    }

    @Transactional(readOnly = true)
    public Page<BookingDetailResponse> getClusterBookings(Long clusterId, Pageable pageable) {
        return bookingRepository.findByClusterIdOrderByCreatedAtDesc(clusterId, pageable)
                .map(responseMapper::toDetail);
    }
}
