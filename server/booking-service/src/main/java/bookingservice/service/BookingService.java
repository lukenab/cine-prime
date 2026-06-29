package bookingservice.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import bookingservice.dto.response.CancelBookingResponse;
import bookingservice.entity.Booking;
import bookingservice.entity.BookingItem;
import bookingservice.entity.BookingStatus;
import bookingservice.entity.Ticket;
import bookingservice.exception.BookingErrorCode;
import bookingservice.mapper.BookingMapper;
import bookingservice.repository.BookingItemRepository;
import bookingservice.repository.BookingRepository;
import bookingservice.repository.SeatLockRepository;
import bookingservice.repository.TicketRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class BookingService {
    BookingRepository bookingRepository;
    BookingItemRepository bookingItemRepository;
    SeatLockRepository seatLockRepository;
    TicketRepository ticketRepository;
    BookingMapper bookingMapper;
    @NonFinal
    @Value("${booking.cancel.mins-before-showtime}")
    int minsBeforeShowtime;

    @Transactional
    public CancelBookingResponse cancelBooking(String bookingId, String currentUserId, boolean isAdmin) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(BookingErrorCode.BOOKING_NOT_FOUND));
        if (!isAdmin && !booking.getAccountId().equals(currentUserId)) {
            throw new AppException(BookingErrorCode.CANCEL_PERMISSION_DENIED);
        }

        String currentStatus = booking.getStatus();
        if (!BookingStatus.PENDING.name().equalsIgnoreCase(currentStatus) &&
                !BookingStatus.CONFIRMED.name().equalsIgnoreCase(currentStatus)) {
            throw new AppException(BookingErrorCode.INVALID_BOOKING_STATE);
        }
        if (booking.getShowDate() != null && booking.getStartTime() != null) {
            LocalDateTime showtime = LocalDateTime.of(booking.getShowDate(), booking.getStartTime());
            if (LocalDateTime.now().plusMinutes(minsBeforeShowtime).isAfter(showtime)) {
                throw new AppException(BookingErrorCode.CANCEL_TIME_EXPIRED);
            }
        }
        List<Ticket> tickets = null;
        if (BookingStatus.CONFIRMED.name().equalsIgnoreCase(currentStatus)) {
            tickets = ticketRepository.findByBooking_BookingId(bookingId);
        }

        List<BookingItem> details = bookingItemRepository.findByBooking_BookingId(bookingId);

        if (tickets != null && !tickets.isEmpty()) {
            tickets.forEach(ticket -> ticket.setStatus(BookingStatus.CANCELLED.name()));
            ticketRepository.saveAll(tickets);
        }

        if (details != null && !details.isEmpty()) {
            List<String> seatCodes = details.stream()
                    .map(BookingItem::getSeatCode)
                    .filter(code -> code != null)
                    .collect(Collectors.toList());

            if (!seatCodes.isEmpty()) {
                seatLockRepository.releaseSeatsByList(booking.getShowtimeId(), seatCodes);
            }
        }

        booking.setStatus(BookingStatus.CANCELLED.name());
        Booking bookingSave = bookingRepository.save(booking);

        return bookingMapper.toCancelBookingResponse(bookingSave);
    }
}