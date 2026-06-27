package bookingservice.service;

import java.time.LocalDateTime;

import org.springframework.stereotype.Service;

import bookingservice.dto.response.BookingResponse;
import bookingservice.entity.Booking;
import bookingservice.entity.BookingStatus;
import bookingservice.exception.BookingErrorCode;
import bookingservice.repository.BookingRepository;
import bookingservice.repository.SeatLockRepository;
import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class BookingService {
    BookingRepository bookingRepository;
    SeatLockRepository seatLockRepository;
    int MINS_BEFORE_SHOWTIME = 15;

    @Transactional
    public BookingResponse cancelBooking(String bookingId, String currentUserId, boolean isAdmin) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(BookingErrorCode.BOOKING_NOT_FOUND));

        if (!isAdmin && !booking.getAccountId().equals(currentUserId)) {
            throw new AppException(BookingErrorCode.CANCEL_PERMISSION_DENIED);
        }

        String currentStatus = booking.getStatus();
        System.out.println(BookingStatus.PENDING.name().equalsIgnoreCase(currentStatus) + " dong 42");
        if (!BookingStatus.PENDING.name().equalsIgnoreCase(currentStatus) &&
                !BookingStatus.CONFIRMED.name().equalsIgnoreCase(currentStatus)) {
            throw new AppException(BookingErrorCode.INVALID_BOOKING_STATE);
        }

        LocalDateTime showtime = LocalDateTime.of(booking.getShowDate(), booking.getStartTime());
        if (showtime.isBefore(LocalDateTime.now().plusMinutes(MINS_BEFORE_SHOWTIME))) {
            throw new AppException(BookingErrorCode.CANCEL_TIME_EXPIRED);
        }

        booking.setStatus(BookingStatus.CANCELLED.name());
        bookingRepository.save(booking);

        Long showtimeId = booking.getShowtimeId();
        String accountId = booking.getAccountId();

        seatLockRepository.releaseSeats(showtimeId, accountId);

        return new BookingResponse(
                booking.getBookingId(),
                booking.getStatus(),
                booking.getUpdatedAt());
    }
}
