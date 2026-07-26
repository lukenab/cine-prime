package bookingservice.service;

import bookingservice.client.ShowtimeClient;
import bookingservice.dto.inventory.InventoryReleaseRequest;
import bookingservice.dto.inventory.InventoryReservationRequest;
import bookingservice.dto.inventory.InventoryReservationResponse;
import bookingservice.dto.request.BookingRequest;
import bookingservice.dto.response.*;
import bookingservice.entity.*;
import bookingservice.exception.BookingErrorCode;
import bookingservice.mapper.BookingMapper;
import bookingservice.repository.*;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import movie.theater.common.exception.AppException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class BookingService {
    private final BookingRepository bookingRepository;
    private final BookingItemRepository bookingItemRepository;
    private final TicketRepository ticketRepository;
    private final CompensationTaskRepository compensationTaskRepository;
    private final ShowtimeClient showtimeClient;
    private final BookingMapper bookingMapper;
    private final BookingOperationService operationService;

    @Value("${booking.cancel.mins-before-showtime}")
    int minsBeforeShowtime;

    public CreateBookingResponse createBookingAndHoldSeats(
            BookingRequest request, String currentUserId, boolean isMember, String idempotencyKey) {
        if (!isMember) {
            throw new AppException(BookingErrorCode.MEMBER_ONLY_ACTION);
        }
        validateSeats(request);

        String requestHash = hash(currentUserId + "|" + request.getShowtimeId() + "|" +
                request.getSeatIds().stream().sorted().toList());
        String correlationId = UUID.randomUUID().toString();
        IdempotencyRecord operation = operationService.begin(currentUserId, idempotencyKey, requestHash, correlationId);

        if (operation.getStatus() == OperationStatus.SUCCEEDED && operation.getBooking() != null) {
            Booking existing = operation.getBooking();
            List<BookingItemResponse> items = existing.getBookingDetails().stream()
                    .map(bookingMapper::toBookingItemResponse)
                    .toList();
            return bookingMapper.toCreateBookingResponse(existing, items, existing.getExpiresAt());
        }

        String bookingId = UUID.randomUUID().toString();
        String holdReference = bookingId;
        ApiResponse<InventoryReservationResponse> reserveEnvelope = showtimeClient.reserve(
                request.getShowtimeId(),
                "reserve:" + bookingId,
                InventoryReservationRequest.builder()
                        .holdReference(holdReference)
                        .ownerAccountId(currentUserId)
                        .showtimeSeatIds(request.getSeatIds())
                        .build());
        InventoryReservationResponse reserve = reserveEnvelope == null ? null : reserveEnvelope.getResult();
        if (reserve == null || reserve.getShowtime() == null || reserve.getSeats() == null) {
            operationService.retryableFailure(operation.getRecordId());
            throw new AppException(BookingErrorCode.SEATS_ALREADY_TAKEN);
        }

        Booking booking = toBooking(bookingId, holdReference, currentUserId, request, reserve);
        List<BookingItemResponse> itemResponses = reserve.getSeats().stream()
                .map(seat -> BookingItemResponse.builder()
                        .seatId(seat.getShowtimeSeatId())
                        .seatLabel(seat.getSeatCode())
                        .price(seat.getPrice())
                        .build())
                .toList();
        try {
            Booking saved = bookingRepository.saveAndFlush(booking);
            operationService.succeed(operation.getRecordId(), saved, "{\"bookingId\":\"" + saved.getBookingId() + "\"}");
            return bookingMapper.toCreateBookingResponse(saved, itemResponses, saved.getExpiresAt());
        } catch (RuntimeException persistenceFailure) {
            compensateReservation(bookingId, holdReference, reserve, correlationId);
            operationService.retryableFailure(operation.getRecordId());
            throw persistenceFailure;
        }
    }

    private Booking toBooking(String bookingId, String holdReference, String accountId,
                              BookingRequest request, InventoryReservationResponse reserve) {
        InventoryReservationResponse.ShowtimeSnapshot showtime = reserve.getShowtime();
        BigDecimal total = reserve.getSeats().stream()
                .map(InventoryReservationResponse.SeatSnapshot::getPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        int points = 0;
        BigDecimal pointsDiscount = BigDecimal.ZERO;
        BigDecimal finalAmount = total.subtract(pointsDiscount).max(BigDecimal.ZERO);

        Booking booking = Booking.builder()
                .bookingId(bookingId)
                .bookingCode("BK-" + bookingId.substring(0, 8).toUpperCase(Locale.ROOT))
                .bookingType(BookingType.ONLINE)
                .accountId(accountId)
                .showtimeId(showtime.getShowtimeId())
                .movieId(showtime.getMovieId())
                .movieName(showtime.getMovieName())
                .clusterId(showtime.getClusterId())
                .clusterName(showtime.getClusterName())
                .cinemaRoomId(showtime.getCinemaRoomId())
                .cinemaRoomName(showtime.getCinemaRoomName())
                .showDate(showtime.getShowDate())
                .startTime(showtime.getStartTime())
                .showtimeTimezone(showtime.getTimezone() == null ? "Asia/Ho_Chi_Minh" : showtime.getTimezone())
                .holdReference(holdReference)
                .totalAmount(total)
                .pointsUsed(points)
                .pointsDiscount(pointsDiscount)
                .finalAmount(finalAmount)
                .status(BookingStatus.PENDING_PAYMENT)
                .inventoryStatus(InventoryStatus.HELD)
                .expiresAt(reserve.getExpiresAt())
                .createdBy(accountId)
                .build();

        reserve.getSeats().forEach(seat -> booking.getBookingDetails().add(BookingItem.builder()
                .booking(booking)
                .showtimeSeatId(seat.getShowtimeSeatId())
                .seatCode(seat.getSeatCode())
                .seatType(seat.getSeatType())
                .unitPrice(seat.getPrice())
                .finalPrice(seat.getPrice())
                .build()));
        booking.setInventoryReservation(InventoryReservation.builder()
                .booking(booking)
                .externalHoldId(holdReference)
                .holdToken(reserve.getHoldToken())
                .status(InventoryStatus.HELD)
                .expiresAt(reserve.getExpiresAt())
                .build());
        return booking;
    }

    private void compensateReservation(String bookingId, String holdReference,
                                       InventoryReservationResponse reserve, String correlationId) {
        InventoryReleaseRequest command = InventoryReleaseRequest.builder()
                .holdToken(reserve.getHoldToken())
                .holdReference(holdReference)
                .reason("BOOKING_PERSIST_FAILED")
                .build();
        try {
            showtimeClient.release("release:create-failed:" + bookingId, command);
        } catch (RuntimeException releaseFailure) {
            compensationTaskRepository.save(CompensationTask.builder()
                    .taskType("RELEASE_INVENTORY")
                    .targetService("movie-service")
                    .targetReference(holdReference)
                    .idempotencyKey("release:create-failed:" + bookingId)
                    .status("PENDING")
                    .commandPayload("{\"holdReference\":\"" + holdReference + "\"}")
                    .correlationId(correlationId)
                    .nextAttemptAt(OffsetDateTime.now())
                    .lastError(releaseFailure.getMessage())
                    .build());
        }
    }

    private void validateSeats(BookingRequest request) {
        if (request.getSeatIds() == null || request.getSeatIds().isEmpty()) {
            throw new AppException(BookingErrorCode.INVALID_SEAT_SELECTION);
        }
        if (request.getSeatIds().stream().distinct().count() != request.getSeatIds().size()) {
            throw new AppException(BookingErrorCode.DUPLICATE_SEATS_IN_REQUEST);
        }
    }

    private String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    @Transactional(readOnly = true)
    public BookingDetailResponse getBookingById(String id, String accountId, boolean isAdmin) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new AppException(BookingErrorCode.BOOKING_NOT_FOUND));
        if (!isAdmin && !Objects.equals(booking.getAccountId(), accountId)) {
            throw new AppException(BookingErrorCode.BOOKING_NOT_FOUND);
        }
        return bookingMapper.toBookingDetailResponse(
                booking, bookingItemRepository.findByBooking_BookingId(id));
    }

    @Transactional(readOnly = true)
    public BookingListResponse getMyBookings(String currentUserId, int page, int size) {
        Pageable pageable = PageRequest.of(page, Math.min(size, 100), Sort.by("createdAt").descending());
        return bookingMapper.toBookingListResponse(
                bookingRepository.findAllByAccountId(currentUserId, pageable));
    }

    @Transactional
    public CancelBookingResponse cancelBooking(String bookingId, String currentUserId, boolean isAdmin) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(BookingErrorCode.BOOKING_NOT_FOUND));
        if (!isAdmin && !Objects.equals(booking.getAccountId(), currentUserId)) {
            throw new AppException(BookingErrorCode.CANCEL_PERMISSION_DENIED);
        }
        if (booking.getTickets().stream().anyMatch(ticket -> ticket.getStatus() == TicketStatus.USED)) {
            throw new AppException(BookingErrorCode.INVALID_BOOKING_STATE);
        }
        booking.setStatus(BookingStatus.CANCEL_REQUESTED);
        return bookingMapper.toCancelBookingResponse(booking);
    }
}
