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

    // 1. Đảm bảo ở DB đã có UNIQUE KEY / UNIQUE INDEX trên 2 cột: (showtime_id,
    // seat_id)

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

        cleanExpiredLocksAndHold(request.getShowtimeId(), request.getSeatIds(), currentUserId);

        BigDecimal totalPrice = BigDecimal.ZERO;
        List<BookingItemResponse> itemResponses = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expiredAt = now.plusMinutes(10);

        Booking booking = Booking.builder()
                .status(BookingStatus.PENDING.name())
                .accountId(currentUserId)
                .showtimeId(request.getShowtimeId())
                .totalAmount(BigDecimal.ZERO)
                .bookingDetails(new ArrayList<>())
                .build();

        for (Long seatId : request.getSeatIds()) {
            BigDecimal seatPrice = BigDecimal.valueOf(85000);
            totalPrice = totalPrice.add(seatPrice);

            String temporarySeatCode = "Seat-" + seatId;

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

        return bookingMapper.toCreateBookingResponse(savedBooking, itemResponses, expiredAt);
    }

    private void cleanExpiredLocksAndHold(Long showtimeId, List<Long> seatIds, String accountId) {
        List<String> seatIdStrs = seatIds.stream()
                .map(String::valueOf)
                .collect(Collectors.toList());

        LocalDateTime now = LocalDateTime.now();

        List<SeatLock> existingLocks = seatLockRepository.findByShowtimeIdAndSeatIdInForUpdate(showtimeId, seatIdStrs);

        for (SeatLock existingLock : existingLocks) {
            if (existingLock.getExpiresAt().isAfter(now)) {
                throw new AppException(BookingErrorCode.SEAT_ALREADY_LOCKED);
            }
        }

        seatLockRepository.deleteExpiredLocks(showtimeId, seatIdStrs, now);
        seatLockRepository.flush(); 

        List<SeatLock> newLocks = seatIdStrs.stream().map(seatIdStr -> SeatLock.builder()
                .showtimeId(showtimeId)
                .seatId(seatIdStr)
                .lockedByAccountId(accountId)
                .expiresAt(now.plusMinutes(10))
                .build()).collect(Collectors.toList());

        try {
            seatLockRepository.saveAll(newLocks);
            seatLockRepository.flush();
        } catch (DataIntegrityViolationException ex) {
            throw new AppException(BookingErrorCode.SEAT_ALREADY_LOCKED);
        }
    }

    @Transactional
    public SeatHoldResponse createSeatLocks(HoldSeatRequest request) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expiresAt = now.plusMinutes(10);
        if (request.getSeatIds() == null || request.getSeatIds().isEmpty()) {
            throw new AppException(BookingErrorCode.INVALID_SEAT_SELECTION);
        }
        long uniqueSeatsCount = request.getSeatIds().stream()
                .distinct()
                .count();
        if (uniqueSeatsCount != request.getSeatIds().size()) {
            throw new AppException(BookingErrorCode.DUPLICATE_SEATS_IN_REQUEST);
        }
        List<SeatLock> activeLocks = seatLockRepository.findActiveLocks(
                request.getShowtimeId(),
                request.getSeatIds(),
                now);

        if (!activeLocks.isEmpty()) {
            throw new AppException(BookingErrorCode.SEATS_ALREADY_TAKEN);
        }

        seatLockRepository.releaseSeatsByList(request.getShowtimeId(), request.getSeatIds());

        List<SeatLock> newLocks = request.getSeatIds().stream().map(seatId -> SeatLock.builder()
                .showtimeId(request.getShowtimeId())
                .seatId(seatId)
                .lockedByAccountId(request.getAccountId())
                .expiresAt(expiresAt)
                .build()).collect(Collectors.toList());

        List<SeatLock> savedLocks = seatLockRepository.saveAll(newLocks);

        return bookingMapper.toSeatHoldResponse(savedLocks);
    }

    @Transactional(readOnly = true)
    public BookingDetailResponse getBookingById(String id) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new AppException(BookingErrorCode.BOOKING_NOT_FOUND));

        List<BookingItem> details = bookingItemRepository.findByBooking_BookingId(id);

        return bookingMapper.toBookingDetailResponse(booking, details);
    }

    @Transactional(readOnly = true)
    public BookingListResponse getMyBookings(String currentUserId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("bookingId").descending());

        Page<Booking> bookingPage = bookingRepository.findAllByAccountId(currentUserId, pageable);

        return bookingMapper.toBookingListResponse(bookingPage);
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

        return bookingMapper.toCancelBookingResponse(booking);
    }

}