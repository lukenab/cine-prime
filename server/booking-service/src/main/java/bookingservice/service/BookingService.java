package bookingservice.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.core.context.SecurityContextHolder; // Đảm bảo đã import đúng để lấy JWT info

import bookingservice.dto.response.BookingDetailResponse;
import bookingservice.dto.response.BookingItemResponse;
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
        // --- 1. BUSINESS VALIDATION (NÂNG CAO) ---
        if (!isMember) {
            throw new AppException(BookingErrorCode.MEMBER_ONLY_ACTION);
        }
        // Check trùng lặp seatIds trực tiếp trong request payload
        long distinctSeatCount = request.getSeatIds().stream().distinct().count();
        if (distinctSeatCount != request.getSeatIds().size()) {
            throw new AppException(BookingErrorCode.DUPLICATE_SEATS_IN_REQUEST);
        }

        // Check trạng thái suất chiếu (Phải tồn tại và ở trạng thái OPEN)
        // ShowtimeResponse showtime =
        // showtimeClient.getShowtimeById(request.getShowtimeId());
        // if (showtime == null || !"OPEN".equalsIgnoreCase(showtime.getStatus())) {
        // throw new AppException(BookingErrorCode.SHOWTIME_NOT_AVAILABLE);
        // }

        // Lấy thông tin tài khoản đang đăng nhập

        // Check số điểm sử dụng không được vượt quá số điểm hiện có của Member
        if (request.getPointsUsed() > 0) {
            Integer currentPoints = memberClient.getCurrentPoints(currentUserId);
            if (currentPoints == null || request.getPointsUsed() > currentPoints) {
                throw new AppException(BookingErrorCode.INSUFFICIENT_POINTS);
            }
        }

        // --- 2. LẤY DANH SÁCH GHẾ & LỌC ---
        // Giả lập danh sách ghế (Sau này thay thế bằng:
        // showtimeClient.getAllSeatsByShowtime(request.getShowtimeId()))
        List<SeatAvailabilityResponse> allSeatsInShowtime = List.of(
                new SeatAvailabilityResponse(101L, BigDecimal.valueOf(85000), "A1", "NORMAL", "AVAILABLE", 101L,
                        request.getShowtimeId()),
                new SeatAvailabilityResponse(102L, BigDecimal.valueOf(85000), "A2", "NORMAL", "AVAILABLE", 102L,
                        request.getShowtimeId()),
                new SeatAvailabilityResponse(103L, BigDecimal.valueOf(110000), "B1", "VIP", "AVAILABLE", 103L,
                        request.getShowtimeId()),
                new SeatAvailabilityResponse(104L, BigDecimal.valueOf(110000), "B2", "VIP", "AVAILABLE", 104L,
                        request.getShowtimeId()));

        // Lọc ra danh sách chi tiết các ghế mà khách hàng chọn
        List<SeatAvailabilityResponse> selectedSeats = allSeatsInShowtime.stream()
                .filter(seat -> request.getSeatIds().contains(seat.getShowtimeSeatId()))
                .collect(Collectors.toList());

        // Kiểm tra số lượng tìm thấy trong DB có khớp với request gửi lên không
        if (selectedSeats.size() != request.getSeatIds().size()) {
            throw new AppException(BookingErrorCode.INVALID_SEAT_SELECTION);
        }

        // Concurrency Control: Kiểm tra xem có ghế nào đã bị đặt hoặc khóa mất rồi
        // không
        boolean isAnySeatTaken = selectedSeats.stream()
                .anyMatch(seat -> !"AVAILABLE".equalsIgnoreCase(seat.getStatus()));
        if (isAnySeatTaken) {
            throw new AppException(BookingErrorCode.SEATS_ALREADY_TAKEN);
        }

        // --- 3. TÍNH TOÁN & LƯU TRỮ ---

        // Tính tổng tiền từ giá gốc hệ thống
        BigDecimal totalPrice = selectedSeats.stream()
                .map(SeatAvailabilityResponse::getPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Khởi tạo & Lưu Booking trạng thái PENDING
        Booking booking = Booking.builder()
                .status(BookingStatus.PENDING.name())
                .accountId(currentUserId)
                .showtimeId(request.getShowtimeId())
                .totalAmount(totalPrice)
                .build();
        Booking savedBooking = bookingRepository.save(booking);

        // Lưu chi tiết BookingItem
        List<BookingItem> items = selectedSeats.stream()
                .<BookingItem>map(seat -> BookingItem.builder()
                        .booking(savedBooking)
                        .showtimeSeatId(seat.getShowtimeSeatId())
                        .seatCode(seat.getSeatCode())
                        .unitPrice(seat.getPrice())
                        .build())
                .collect(Collectors.toList());
        bookingItemRepository.saveAll(items);

        // --- 4. KHÓA GHẾ TẠM THỜI (HOLD SEATS) ---
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expiredAt = now.plusMinutes(10);

        List<SeatLock> locks = selectedSeats.stream()
                .<SeatLock>map(seat -> SeatLock.builder()
                        .showtimeId(request.getShowtimeId())
                        .seatId(seat.getSeatCode())
                        .expiresAt(expiredAt)
                        .build())
                .collect(Collectors.toList());
        seatLockRepository.saveAll(locks);

        // --- 5. MAPPING ĐẦU RA SỬ DỤNG BOOKINGMAPPER ---
        List<BookingItemResponse> itemResponses = selectedSeats.stream()
                .map(bookingMapper::toBookingItemResponse)
                .collect(Collectors.toList());

        return bookingMapper.toCreateBookingResponse(savedBooking, itemResponses, expiredAt);
    }

    /**
     * FEATURE 2: Lấy trạng thái danh sách ghế (AVAILABLE, LOCKED, BOOKED) của một
     * suất chiếu
     */
    // @Transactional(readOnly = true)
    // public List<SeatAvailabilityResponse> getSeatAvailability(Long showtimeId) {
    // // Lấy toàn bộ ghế cấu hình của suất chiếu này từ bên showtime-service
    // List<SeatAvailabilityResponse> allSeats =
    // showtimeClient.getAllSeatsByShowtime(showtimeId);

    // // Lấy danh sách các mã ghế hiện đang bị lock còn hạn hoặc đã có booking
    // // CONFIRMED
    // List<SeatLock> activeLocks =
    // seatLockRepository.findAllActiveLocks(showtimeId, LocalDateTime.now());
    // List<String> confirmedSeatCodes =
    // bookingItemRepository.findConfirmedSeatCodesByShowtime(showtimeId);

    // return allSeats.stream().map(seat -> {
    // String status = "AVAILABLE";
    // if (confirmedSeatCodes.contains(seat.getSeatCode())) {
    // status = "BOOKED";
    // } else if (activeLocks.stream().anyMatch(lock ->
    // lock.getSeatCode().equals(seat.getSeatCode()))) {
    // status = "LOCKED";
    // }
    // return new SeatAvailabilityResponse(seat.getSeatCode(), status);
    // }).collect(Collectors.toList());
    // }
    @Transactional(readOnly = true)
    public BookingDetailResponse getBookingById(String id) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new AppException(BookingErrorCode.BOOKING_NOT_FOUND));

        List<BookingItem> details = bookingItemRepository.findByBooking_BookingId(id);

        // Gọi qua MapStruct cực kỳ ngắn gọn
        return bookingMapper.toBookingDetailResponse(booking, details);
    }

    @Transactional(readOnly = true)
    public Page<BookingDetailResponse> getAllBookings(Pageable pageable) {
        Page<Booking> bookingPage = bookingRepository.findAll(pageable);

        // MapStruct kết hợp với Stream của Page rất mượt
        return bookingPage.map(bookingMapper::toBookingListResponse);
    }

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
            System.out.println(showtime + " 57");
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
        bookingRepository.save(booking);

        // ĐÃ ĐỔI: Sử dụng mapper thay vì tự map thủ công bằng constructor
        return bookingMapper.toCancelBookingResponse(booking);
    }
}