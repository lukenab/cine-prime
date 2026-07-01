package bookingservice.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.core.context.SecurityContextHolder;
import bookingservice.dto.response.BookingDetailResponse;
import bookingservice.dto.response.BookingItemResponse;
import bookingservice.dto.response.BookingListResponse;
import bookingservice.dto.response.CancelBookingResponse;
import bookingservice.dto.response.CreateBookingResponse;
import bookingservice.dto.response.SeatAvailabilityResponse;
import bookingservice.dto.response.SeatHoldResponse;
import bookingservice.dto.request.BookingRequest;
import bookingservice.dto.request.HoldSeatRequest;
import bookingservice.entity.Booking;
import bookingservice.entity.BookingItem;
import bookingservice.entity.BookingStatus;
import bookingservice.entity.Ticket;
import bookingservice.entity.SeatLock; 
import bookingservice.exception.BookingErrorCode;
import bookingservice.mapper.BookingMapper;
import bookingservice.repository.BookingItemRepository;
import bookingservice.repository.BookingRepository;
import bookingservice.repository.SeatLockRepository;
import bookingservice.repository.TicketRepository;
import bookingservice.client.MemberClient;
import bookingservice.client.ShowtimeClient; 

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
    ShowtimeClient showtimeClient; 
    BookingMapper bookingMapper;
    MemberClient memberClient;
    @NonFinal
    @Value("${booking.cancel.mins-before-showtime}")
    int minsBeforeShowtime;

    // 1. Đảm bảo ở DB đã có UNIQUE KEY / UNIQUE INDEX trên 2 cột: (showtime_id,
    // seat_id)

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public CreateBookingResponse createBookingAndHoldSeats(BookingRequest request, String currentUserId,
            boolean isMember) {

        if (!isMember) {
            throw new AppException(BookingErrorCode.MEMBER_ONLY_ACTION);
        }

        long distinctSeatCount = request.getSeatIds().stream().distinct().count();
        if (distinctSeatCount != request.getSeatIds().size()) {
            throw new AppException(BookingErrorCode.DUPLICATE_SEATS_IN_REQUEST);
        }

        List<String> seatIdStrs = request.getSeatIds().stream()
                .map(String::valueOf)
                .collect(Collectors.toList());

        // 1. Kiểm tra trạng thái ghế đã thanh toán/xác nhận chưa
        if (bookingItemRepository.existsByShowtimeIdAndSeatCodeInAndStatusConfirmed(request.getShowtimeId(),
                seatIdStrs)) {
            throw new AppException(BookingErrorCode.SEATS_ALREADY_TAKEN);
        }

        // 2. Gọi hàm xử lý Lock thông minh (Đã giải quyết việc check expires_at và
        // trùng lặp)
        cleanExpiredLocksAndHold(request.getShowtimeId(), seatIdStrs, currentUserId);


        seatLockRepository.releaseSeatsByBookingAndList(request.getShowtimeId(), seatCodesStr, null);

        // 3. Logic tạo Booking & chi tiết hóa đơn
        BigDecimal totalPrice = BigDecimal.ZERO;
        List<BookingItemResponse> itemResponses = new ArrayList<>();

        int pointsUsed = request.getPointsUsed() != null ? request.getPointsUsed() : 0;

        Booking booking = Booking.builder()
                .status(BookingStatus.PENDING.name())
                .pointsUsed(pointsUsed)
                .accountId(currentUserId)
                .showtimeId(request.getShowtimeId())
                .totalAmount(BigDecimal.ZERO)
                .bookingDetails(new ArrayList<>())
                .build();

        for (Long seatId : request.getSeatIds()) {
            BigDecimal seatPrice = BigDecimal.valueOf(85000);
            totalPrice = totalPrice.add(seatPrice);
            String temporarySeatCode = String.valueOf(seatId);

            booking.getBookingDetails().add(BookingItem.builder()
                    .booking(booking)
                    .showtimeSeatId(seatId)
                    .seatCode(temporarySeatCode)
                    .unitPrice(seatPrice)
                    .build());

            itemResponses.add(BookingItemResponse.builder()
                    .seatId(seatId)
                    .seatLabel(temporarySeatCode)
                    .price(seatPrice)
                    .build());
        }

        booking.setTotalAmount(totalPrice);
        Booking savedBooking = bookingRepository.save(booking);

        // XÓA BỎ HOÀN TOÀN ĐOẠN CODE TỰ INSERT LOCK Ở ĐÂY! Nhường sân khấu cho bước 2
        // lo.

        return bookingMapper.toCreateBookingResponse(savedBooking, itemResponses, expiredAt);
    }

    private void cleanExpiredLocksAndHold(Long showtimeId, List<String> seatIdStrs, String accountId) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime newExpiresAt = now.plusMinutes(10);

        // 1. Khóa các dòng dữ liệu để tránh tranh chấp (Pessimistic Lock)
        List<SeatLock> existingLocks = seatLockRepository.findByShowtimeIdAndSeatIdInForUpdate(showtimeId, seatIdStrs);

        List<SeatLock> locksToSave = new ArrayList<>();

        for (SeatLock existingLock : existingLocks) {
            if (existingLock.getExpiresAt().isAfter(now)) {
                if (accountId == null || !existingLock.getLockedByAccountId().equals(accountId)) {
                    throw new AppException(BookingErrorCode.SEAT_ALREADY_LOCKED);
                }
                throw new AppException(BookingErrorCode.SEAT_ALREADY_HELD_BY_YOU);
            } else {
                seatLockRepository.delete(existingLock);
            }
        }

        // Đẩy lệnh delete xuống DB trước để tránh conflict unique constraint khi insert
        // mới
        seatLockRepository.flush();

        // 2. Những ghế chưa từng có lock, hoặc lock đã hết hạn
        for (String seatIdStr : seatIdStrs) {
            SeatLock newLock = SeatLock.builder()
                    .showtimeId(showtimeId)
                    .seatId(seatIdStr)
                    .lockedByAccountId(accountId)
                    .expiresAt(newExpiresAt)
                    .build();
            locksToSave.add(newLock);
        }

        try {
            seatLockRepository.saveAll(locksToSave);
            seatLockRepository.flush();
        } catch (DataIntegrityViolationException ex) {
            // Rationale: SELECT ... FOR UPDATE (pessimistic lock) chỉ khóa được các bản ghi ĐÃ tồn tại (để thay lock đã hết hạn).
            // Unique constraint (uc_showtime_seat) là chốt chặn cuối cùng ngăn ngừa 2 request đồng thời tạo lock mới cho cùng một ghế chưa từng được lock.
            throw new AppException(BookingErrorCode.SEAT_ALREADY_LOCKED);
        }
    }

    @Transactional
    public SeatHoldResponse createSeatLocks(HoldSeatRequest request, String accountId) {
        if (request.getSeatIds() == null || request.getSeatIds().isEmpty()) {
            throw new AppException(BookingErrorCode.INVALID_SEAT_SELECTION);
        }
        long uniqueSeatsCount = request.getSeatIds().stream()
                .distinct()
                .count();
        if (uniqueSeatsCount != request.getSeatIds().size()) {
            throw new AppException(BookingErrorCode.DUPLICATE_SEATS_IN_REQUEST);
        }

        List<String> seatIdStrs = request.getSeatIds().stream()
                .map(String::valueOf)
                .collect(Collectors.toList());

        cleanExpiredLocksAndHold(request.getShowtimeId(), seatIdStrs, accountId);

        List<SeatLock> savedLocks = seatLockRepository.findByShowtimeIdAndSeatIdInForUpdate(request.getShowtimeId(), seatIdStrs);
        return bookingMapper.toSeatHoldResponse(savedLocks);
    }

    @Transactional(readOnly = true)
    public BookingDetailResponse getBookingById(String id, String accountId, boolean isAdmin) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new AppException(BookingErrorCode.BOOKING_NOT_FOUND));

        if (!isAdmin && !booking.getAccountId().equals(accountId)) {
            throw new AppException(BookingErrorCode.BOOKING_NOT_FOUND);
        }

        List<BookingItem> details = bookingItemRepository.findByBooking_BookingId(id);

        return bookingMapper.toBookingDetailResponse(booking, details);
    }

    @Transactional(readOnly = true)
    public BookingListResponse getMyBookings(String currentUserId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("bookingId").descending());

        Page<Booking> bookingPage;
        bookingPage = bookingRepository.findAllByAccountId(currentUserId, pageable);

        return bookingMapper.toBookingListResponse(bookingPage);
    }

    @Transactional
    public CancelBookingResponse cancelBooking(String bookingId, String currentUserId, boolean isAdmin) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(BookingErrorCode.BOOKING_NOT_FOUND));
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
                // SỬA TẠI ĐÂY: Truyền thêm accountId vào để câu lệnh SQL xóa chính xác bản ghi
                // Lock liên kết với người dùng này
                seatLockRepository.releaseSeatsByAccountAndList(booking.getShowtimeId(), seatCodes, booking.getAccountId());
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