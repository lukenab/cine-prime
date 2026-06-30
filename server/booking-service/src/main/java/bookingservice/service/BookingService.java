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
    // 1. Kiểm tra tồn tại của Booking
    Booking booking = bookingRepository.findById(bookingId)
            .orElseThrow(() -> new AppException(BookingErrorCode.BOOKING_NOT_FOUND));

    // 2. [Confirm] Phân quyền: Admin hủy mọi booking, Customer chỉ hủy của chính mình
    if (!isAdmin && !booking.getAccountId().equals(currentUserId)) {
        throw new AppException(BookingErrorCode.CANCEL_PERMISSION_DENIED);
    }

    // 3. [Confirm] Kiểm tra trạng thái: Chỉ cho phép PENDING hoặc CONFIRMED
    String currentStatus = booking.getStatus();
    if (!BookingStatus.PENDING.name().equalsIgnoreCase(currentStatus) &&
            !BookingStatus.CONFIRMED.name().equalsIgnoreCase(currentStatus)) {
        throw new AppException(BookingErrorCode.INVALID_BOOKING_STATE);
    }

    // 4. Kiểm tra thời gian hủy (nếu sát giờ chiếu)
    if (booking.getShowDate() != null && booking.getStartTime() != null) {
        LocalDateTime showtime = LocalDateTime.of(booking.getShowDate(), booking.getStartTime());
        if (LocalDateTime.now().plusMinutes(minsBeforeShowtime).isAfter(showtime)) {
            throw new AppException(BookingErrorCode.CANCEL_TIME_EXPIRED);
        }
    }

    // 5. [Confirm] Chuyển ticket liên quan của booking CONFIRMED sang CANCELLED
    if (BookingStatus.CONFIRMED.name().equalsIgnoreCase(currentStatus)) {
        List<Ticket> tickets = ticketRepository.findByBooking_BookingId(bookingId);
        if (tickets != null && !tickets.isEmpty()) {
            tickets.forEach(ticket -> ticket.setStatus(BookingStatus.CANCELLED.name()));
            ticketRepository.saveAll(tickets);
        }
    }

    // 6. [Confirm] Xóa Seat Lock ĐÚNG ghế và KHÔNG xóa nhầm của booking khác
    List<BookingItem> details = bookingItemRepository.findByBooking_BookingId(bookingId);
    if (details != null && !details.isEmpty()) {
        List<String> seatCodes = details.stream()
                    .map(BookingItem::getSeatCode)
                    .filter(code -> code != null)
                    .collect(Collectors.toList());

        if (!seatCodes.isEmpty()) {
            // SỬA TẠI ĐÂY: Truyền thêm bookingId vào để câu lệnh SQL xóa chính xác bản ghi Lock liên kết với Booking này
            seatLockRepository.releaseSeatsByBookingAndList(booking.getShowtimeId(), seatCodes, bookingId);
        }
    }

    // 7. [Confirm] Cập nhật booking.status = CANCELLED
    booking.setStatus(BookingStatus.CANCELLED.name());
    booking.setUpdatedAt(LocalDateTime.now()); // Đảm bảo ghi nhận thời gian update mới nhất
    Booking bookingSave = bookingRepository.save(booking);

    // 8. [Confirm] Trả về dữ liệu map đúng Format yêu cầu
    return bookingMapper.toCancelBookingResponse(bookingSave);
}
}