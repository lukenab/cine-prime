package bookingservice.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import bookingservice.dto.response.BookingDetailResponse;
import bookingservice.dto.response.BookingItemResponse;
import bookingservice.dto.response.BookingListResponse;
import bookingservice.dto.response.CancelBookingResponse;
import bookingservice.dto.response.CreateBookingResponse;
import bookingservice.dto.response.SeatAvailabilityResponse;
import bookingservice.dto.request.BookingRequest;
import bookingservice.entity.Booking;
import bookingservice.entity.BookingItem;
import bookingservice.entity.BookingStatus;
import bookingservice.entity.Ticket;
import bookingservice.entity.SeatLock; // Import entity SeatLock
import bookingservice.exception.BookingErrorCode;
import bookingservice.mapper.BookingMapper;
import bookingservice.repository.BookingItemRepository;
import bookingservice.repository.BookingRepository;
import bookingservice.repository.SeatLockRepository;
import bookingservice.repository.TicketRepository;
import bookingservice.client.MemberClient;
import bookingservice.client.ShowtimeClient; // OpenFeign Client sang showtime-service

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
    ShowtimeClient showtimeClient; // Tích hợp OpenFeign Client
    BookingMapper bookingMapper;
    MemberClient memberClient;
    @NonFinal
    @Value("${booking.cancel.mins-before-showtime}")
    int minsBeforeShowtime;

    @Transactional
    public CreateBookingResponse createBookingAndHoldSeats(BookingRequest request, String currentUserId,
            boolean isMember) {

        if (!isMember) {
            throw new AppException(BookingErrorCode.MEMBER_ONLY_ACTION);
        }

        long distinctSeatCount = request.getSeatIds().stream().distinct().count();
        if (distinctSeatCount != request.getSeatIds().size()) {
            throw new AppException(BookingErrorCode.DUPLICATE_SEATS_IN_REQUEST);
        }
        List<SeatAvailabilityResponse> allSeatsInShowtime = List.of(
                new SeatAvailabilityResponse(101L, BigDecimal.valueOf(85000), "A1", "NORMAL", "AVAILABLE", 101L,
                        request.getShowtimeId()),
                new SeatAvailabilityResponse(102L, BigDecimal.valueOf(85000), "A2", "NORMAL", "AVAILABLE", 102L,
                        request.getShowtimeId()),
                new SeatAvailabilityResponse(103L, BigDecimal.valueOf(110000), "B1", "VIP", "AVAILABLE", 103L,
                        request.getShowtimeId()),
                new SeatAvailabilityResponse(104L, BigDecimal.valueOf(110000), "B2", "VIP", "AVAILABLE", 104L,
                        request.getShowtimeId()));

        List<SeatAvailabilityResponse> selectedSeats = allSeatsInShowtime.stream()
                .filter(seat -> request.getSeatIds().contains(seat.getSeatId()))
                .collect(Collectors.toList());

        if (selectedSeats.size() != request.getSeatIds().size()) {
            throw new AppException(BookingErrorCode.INVALID_SEAT_SELECTION);
        }

        List<String> seatCodesStr = selectedSeats.stream()
                .map(SeatAvailabilityResponse::getSeatCode)
                .collect(Collectors.toList());

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expiredAt = now.plusMinutes(10);

        if (bookingItemRepository.existsByShowtimeIdAndSeatCodeInAndStatusConfirmed(request.getShowtimeId(),
                seatCodesStr)) {
            throw new AppException(BookingErrorCode.SEATS_ALREADY_TAKEN);
        }

        if (seatLockRepository.existsByShowtimeIdAndSeatIdInAndExpiresAtAfter(request.getShowtimeId(), seatCodesStr,
                now)) {
            throw new AppException(BookingErrorCode.SEATS_ALREADY_TAKEN);
        }

        seatLockRepository.releaseSeatsByBookingAndList(request.getShowtimeId(), seatCodesStr, null);

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

        for (SeatAvailabilityResponse seat : selectedSeats) {
            totalPrice = totalPrice.add(seat.getPrice());

            booking.getBookingDetails().add(BookingItem.builder()
                    .booking(booking)
                    .showtimeSeatId(seat.getShowtimeSeatId())
                    .seatCode(seat.getSeatCode())
                    .unitPrice(seat.getPrice())
                    .build());

            itemResponses.add(bookingMapper.toBookingItemResponse(seat));
        }
        booking.setTotalAmount(totalPrice);

        Booking savedBooking = bookingRepository.save(booking);

        List<SeatLock> newLocks = seatCodesStr.stream().map(seatCode -> SeatLock.builder()
                .showtimeId(request.getShowtimeId())
                .seatId(seatCode)
                .lockedByAccountId(currentUserId)
                .expiresAt(expiredAt)
                .build()).collect(Collectors.toList());

        seatLockRepository.saveAll(newLocks);

        return bookingMapper.toCreateBookingResponse(savedBooking, itemResponses, expiredAt);
    }

    // @Transactional
    // public SeatHoldResponse holdSeats(HoldSeatRequest request, String accountId)
    // {
    // LocalDateTime now = LocalDateTime.now();
    // LocalDateTime expiresAt = now.plusMinutes(10);
    // if (request.getSeatIds() == null || request.getSeatIds().isEmpty()) {
    // throw new AppException(BookingErrorCode.INVALID_SEAT_SELECTION);
    // }
    // long uniqueSeatsCount = request.getSeatIds().stream()
    // .distinct()
    // .count();
    // if (uniqueSeatsCount != request.getSeatIds().size()) {
    // throw new AppException(BookingErrorCode.DUPLICATE_SEATS_IN_REQUEST);
    // }

    // if
    // (seatLockRepository.existsByShowtimeIdAndSeatIdInAndExpiresAtAfter(request.getShowtimeId(),
    // request.getSeatIds(), now)) {
    // throw new AppException(BookingErrorCode.SEATS_ALREADY_TAKEN);
    // }

    // if
    // (bookingItemRepository.existsByShowtimeIdAndSeatCodeInAndStatusConfirmed(request.getShowtimeId(),
    // request.getSeatIds())) {
    // throw new AppException(BookingErrorCode.SEATS_ALREADY_TAKEN);
    // }

    // seatLockRepository.releaseSeatsByBookingAndList(request.getShowtimeId(),
    // request.getSeatIds(), null);

    // List<SeatLock> newLocks = request.getSeatIds().stream().map(seatId ->
    // SeatLock.builder()
    // .showtimeId(request.getShowtimeId())
    // .seatId(seatId)
    // .lockedByAccountId(accountId)
    // .expiresAt(expiresAt)
    // .build()).collect(Collectors.toList());

    // List<SeatLock> savedLocks = seatLockRepository.saveAll(newLocks);

    // return bookingMapper.toSeatHoldResponse(savedLocks);
    // }

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
        // 1. Kiểm tra tồn tại của Booking
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(BookingErrorCode.BOOKING_NOT_FOUND));

        // 2. [Confirm] Phân quyền: Admin hủy mọi booking, Customer chỉ hủy của chính
        // mình
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
                // SỬA TẠI ĐÂY: Truyền thêm bookingId vào để câu lệnh SQL xóa chính xác bản ghi
                // Lock liên kết với Booking này
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