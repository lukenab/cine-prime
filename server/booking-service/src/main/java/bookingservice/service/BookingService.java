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
import bookingservice.dto.response.HeldShowtimeSeatResponse;
import bookingservice.dto.response.MovieSeatHoldResponse;
import bookingservice.dto.response.SeatAvailabilityResponse;
import bookingservice.dto.response.SeatHoldResponse;
import bookingservice.dto.request.BookingRequest;
import bookingservice.dto.request.CreateBookingQuoteRequest;
import bookingservice.dto.request.HoldSeatRequest;
import bookingservice.dto.request.MovieSeatHoldRequest;
import bookingservice.dto.request.PromotionQuoteRequest;
import bookingservice.dto.request.PromotionReserveRequest;
import bookingservice.entity.Booking;
import bookingservice.entity.BookingQuote;
import bookingservice.entity.BookingQuoteItem;
import bookingservice.entity.BookingQuoteStatus;
import bookingservice.entity.BookingItem;
import bookingservice.entity.BookingStatus;
import bookingservice.entity.Ticket;
import bookingservice.entity.SeatLock; 
import bookingservice.exception.BookingErrorCode;
import bookingservice.mapper.BookingMapper;
import bookingservice.repository.BookingItemRepository;
import bookingservice.repository.BookingRepository;
import bookingservice.repository.BookingQuoteRepository;
import bookingservice.repository.SeatLockRepository;
import bookingservice.repository.TicketRepository;
import bookingservice.util.MoneyUtil;
import bookingservice.client.MemberClient;
import bookingservice.client.PromotionClient;
import bookingservice.client.ShowtimeClient; 
import feign.FeignException;

import java.util.UUID;
import java.nio.charset.StandardCharsets;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.dto.ApiResponse;
import movie.theater.common.exception.AppException;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class BookingService {
    BookingRepository bookingRepository;
    BookingQuoteRepository bookingQuoteRepository;
    BookingItemRepository bookingItemRepository;
    SeatLockRepository seatLockRepository;
    TicketRepository ticketRepository;
    ShowtimeClient showtimeClient; 
    PromotionClient promotionClient;
    BookingMapper bookingMapper;
    MemberClient memberClient;
    @NonFinal
    @Value("${booking.cancel.mins-before-showtime}")
    int minsBeforeShowtime;
    @NonFinal
    @Value("${booking.quote.ttl-seconds:300}")
    int quoteTtlSeconds;

    // 1. Đảm bảo ở DB đã có UNIQUE KEY / UNIQUE INDEX trên 2 cột: (showtime_id,
    // seat_id)

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public CreateBookingResponse createBookingAndHoldSeats(
            BookingRequest request,
            String currentUserId,
            boolean isMember,
            String idempotencyKey) {

        if (request.getQuoteId() != null && !request.getQuoteId().isBlank()) {
            return createBookingFromQuote(request.getQuoteId(), request.getPointsUsed(), currentUserId, isMember, idempotencyKey);
        }
        return createBookingAndHoldSeatsDirect(request, currentUserId, isMember, idempotencyKey, null);
    }

    /** Materializes a quote only after its owner and TTL have been checked under a DB lock. */
    private CreateBookingResponse createBookingFromQuote(
            String quoteId, Integer pointsUsed, String currentUserId, boolean isMember, String idempotencyKey) {
        BookingQuote quote = bookingQuoteRepository.findByIdForUpdate(quoteId)
                .orElseThrow(() -> new AppException(BookingErrorCode.QUOTE_NOT_FOUND));
        if (!quote.getAccountId().equals(currentUserId)) {
            throw new AppException(BookingErrorCode.QUOTE_OWNER_MISMATCH);
        }
        if (quote.getExpiresAt().isBefore(LocalDateTime.now())
                || BookingQuoteStatus.EXPIRED.name().equals(quote.getStatus())) {
            quote.setStatus(BookingQuoteStatus.EXPIRED.name());
            throw new AppException(BookingErrorCode.QUOTE_EXPIRED);
        }
        if (BookingQuoteStatus.CONSUMED.name().equals(quote.getStatus())) {
            Booking booking = bookingRepository.findById(quote.getConsumedBookingId())
                    .orElseThrow(() -> new AppException(BookingErrorCode.QUOTE_NOT_FOUND));
            return toCreateResponse(booking);
        }

        BookingRequest directRequest = new BookingRequest();
        directRequest.setShowtimeId(quote.getShowtimeId());
        directRequest.setSeatIds(quote.getItems().stream().map(BookingQuoteItem::getShowtimeSeatId).toList());
        directRequest.setPointsUsed(pointsUsed == null ? 0 : pointsUsed);
        directRequest.setPromotionCode(quote.getPromotionCode());
        CreateBookingResponse result = createBookingAndHoldSeatsDirect(
                directRequest, currentUserId, isMember, idempotencyKey, quote);
        quote.setStatus(BookingQuoteStatus.CONSUMED.name());
        quote.setConsumedBookingId(result.getBookingId());
        return result;
    }

    private CreateBookingResponse createBookingAndHoldSeatsDirect(
            BookingRequest request,
            String currentUserId,
            boolean isMember,
            String idempotencyKey,
            BookingQuote expectedQuote) {

        if (!isMember) {
            throw new AppException(BookingErrorCode.MEMBER_ONLY_ACTION);
        }

        if (request.getShowtimeId() == null || request.getSeatIds() == null || request.getSeatIds().isEmpty()) {
            throw new AppException(BookingErrorCode.INVALID_QUOTE_REQUEST);
        }

        long distinctSeatCount = request.getSeatIds().stream().distinct().count();
        if (distinctSeatCount != request.getSeatIds().size()) {
            throw new AppException(BookingErrorCode.DUPLICATE_SEATS_IN_REQUEST);
        }

        // 1. Kiểm tra trạng thái ghế đã thanh toán/xác nhận chưa
        // 2. Gọi hàm xử lý Lock thông minh (Đã giải quyết việc check expires_at và
        // trùng lặp)
        MovieSeatHoldResponse seatHold = requestAuthoritativeSeatHold(request, idempotencyKey);
        validateHeldSelection(request, seatHold);
        if (expectedQuote != null) {
            validateQuotePriceSnapshot(expectedQuote, seatHold);
        }

        Optional<Booking> replayedBooking = bookingRepository.findBySeatHoldId(seatHold.getHoldId());
        if (replayedBooking.isPresent()) {
            Booking existing = replayedBooking.get();
            if (!existing.getAccountId().equals(currentUserId)) {
                throw new AppException(BookingErrorCode.SEAT_ALREADY_LOCKED);
            }
            List<BookingItemResponse> existingItems = bookingItemRepository
                    .findByBooking_BookingId(existing.getBookingId())
                    .stream()
                    .map(bookingMapper::toBookingItemResponse)
                    .toList();
            return bookingMapper.toCreateBookingResponse(
                    existing, existingItems, existing.getExpiresAt());
        }

        // Expiry returned to the client — matches the 10-minute hold created above
        // 3. Logic tạo Booking & chi tiết hóa đơn
        BigDecimal totalPrice = BigDecimal.ZERO;
        List<BookingItemResponse> itemResponses = new ArrayList<>();

        int pointsUsed = request.getPointsUsed() != null ? request.getPointsUsed() : 0;

        Booking booking = Booking.builder()
                // Tao ID truoc khi goi Promotion Service de reservation va booking
                // cung tham chieu den mot bookingId bat bien, ke ca khi retry.
                .bookingId(deterministicBookingId(currentUserId, idempotencyKey))
                .status(BookingStatus.PENDING.name())
                .pointsUsed(pointsUsed)
                .accountId(currentUserId)
                .showtimeId(request.getShowtimeId())
                .totalAmount(BigDecimal.ZERO)
                .expiresAt(seatHold.getExpiresAt())
                .seatHoldId(seatHold.getHoldId())
                .bookingDetails(new ArrayList<>())
                .build();

        for (HeldShowtimeSeatResponse heldSeat : seatHold.getSeats()) {
            BigDecimal seatPrice = heldSeat.getPrice();
            totalPrice = totalPrice.add(seatPrice);

            booking.getBookingDetails().add(BookingItem.builder()
                    .booking(booking)
                    .showtimeSeatId(heldSeat.getSeatId())
                    .seatCode(heldSeat.getSeatCode())
                    .unitPrice(seatPrice)
                    .build());

            itemResponses.add(BookingItemResponse.builder()
                    .seatId(heldSeat.getSeatId())
                    .seatLabel(heldSeat.getSeatCode())
                    .price(seatPrice)
                    .build());
        }

        booking.setTotalAmount(totalPrice);
        reservePromotionIfRequested(booking, request.getPromotionCode(), seatHold, currentUserId, idempotencyKey, expectedQuote);
        Booking savedBooking = bookingRepository.save(booking);

        // XÓA BỎ HOÀN TOÀN ĐOẠN CODE TỰ INSERT LOCK Ở ĐÂY! Nhường sân khấu cho bước 2
        // lo.

        return bookingMapper.toCreateBookingResponse(savedBooking, itemResponses, seatHold.getExpiresAt());
    }

    private MovieSeatHoldResponse requestAuthoritativeSeatHold(
            BookingRequest request,
            String idempotencyKey) {
        try {
            ApiResponse<MovieSeatHoldResponse> response = showtimeClient.holdSeats(
                    request.getShowtimeId(),
                    idempotencyKey,
                    new MovieSeatHoldRequest(request.getSeatIds()));
            if (response == null || response.getResult() == null) {
                throw new AppException(BookingErrorCode.SHOWTIME_INVENTORY_UNAVAILABLE);
            }
            return response.getResult();
        } catch (FeignException ex) {
            if (ex.status() == 404) {
                throw new AppException(BookingErrorCode.SHOWTIME_NOT_AVAILABLE);
            }
            if (ex.status() == 409) {
                throw new AppException(BookingErrorCode.SEAT_ALREADY_LOCKED);
            }
            if (ex.status() == 400 || ex.status() == 422) {
                throw new AppException(BookingErrorCode.INVALID_SEAT_SELECTION);
            }
            log.error("movie-service seat hold failed: status={}", ex.status(), ex);
            throw new AppException(BookingErrorCode.SHOWTIME_INVENTORY_UNAVAILABLE);
        }
    }

    /**
     * Creates the checkout offer from Movie Service's live seat map. It does
     * not create an inventory hold, therefore an abandoned quote blocks nobody.
     */
    @Transactional
    public bookingservice.dto.response.BookingQuoteResponse createCheckoutQuote(
            CreateBookingQuoteRequest request, String accountId, boolean isMember) {
        if (!isMember) throw new AppException(BookingErrorCode.MEMBER_ONLY_ACTION);
        if (request.showtimeSeatIds().stream().distinct().count() != request.showtimeSeatIds().size()) {
            throw new AppException(BookingErrorCode.DUPLICATE_SEATS_IN_REQUEST);
        }
        bookingservice.dto.response.MovieSeatMapResponse map;
        try {
            ApiResponse<bookingservice.dto.response.MovieSeatMapResponse> response = showtimeClient.getSeatMap(request.showtimeId());
            map = response == null ? null : response.getResult();
        } catch (FeignException ex) {
            if (ex.status() == 404) throw new AppException(BookingErrorCode.SHOWTIME_NOT_AVAILABLE);
            log.error("movie-service seat map failed: status={}", ex.status(), ex);
            throw new AppException(BookingErrorCode.SHOWTIME_INVENTORY_UNAVAILABLE);
        }
        if (map == null || map.movieId() == null || map.seats() == null) {
            throw new AppException(BookingErrorCode.SHOWTIME_INVENTORY_UNAVAILABLE);
        }
        java.util.Map<Long, SeatAvailabilityResponse> availableSeats = map.seats().stream()
                .filter(seat -> seat.getSeatId() != null && "AVAILABLE".equalsIgnoreCase(seat.getStatus()))
                .collect(java.util.stream.Collectors.toMap(SeatAvailabilityResponse::getSeatId, seat -> seat, (left, right) -> left));
        List<SeatAvailabilityResponse> selectedSeats = request.showtimeSeatIds().stream().map(availableSeats::get).toList();
        if (selectedSeats.stream().anyMatch(java.util.Objects::isNull)
                || selectedSeats.stream().anyMatch(seat -> seat.getPrice() == null || seat.getSeatCode() == null)) {
            throw new AppException(BookingErrorCode.SEAT_ALREADY_LOCKED);
        }
        BigDecimal subtotal = selectedSeats.stream().map(SeatAvailabilityResponse::getPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        String normalizedCode = request.promotionCode() == null || request.promotionCode().isBlank()
                ? null : request.promotionCode().trim().toUpperCase();
        BigDecimal discount = BigDecimal.ZERO;
        BigDecimal finalAmount = subtotal;
        String promotionId = null;
        if (normalizedCode != null) {
            try {
                ApiResponse<bookingservice.dto.response.PromotionQuoteResponse> quoteResponse = promotionClient.quote(
                        new PromotionQuoteRequest(normalizedCode, "quote:" + UUID.randomUUID(), accountId,
                                map.movieId(), request.showtimeId(), map.clusterId(), subtotal, "VND"));
                bookingservice.dto.response.PromotionQuoteResponse promotionQuote = quoteResponse == null ? null : quoteResponse.getResult();
                if (promotionQuote == null) throw new AppException(BookingErrorCode.PROMOTION_SERVICE_UNAVAILABLE);
                if (!promotionQuote.eligible()) {
                    if ("PROMOTION_QUOTA_EXHAUSTED".equals(promotionQuote.reasonCode())) {
                        throw new AppException(BookingErrorCode.PROMOTION_QUOTA_EXHAUSTED);
                    }
                    throw new AppException(BookingErrorCode.PROMOTION_NOT_APPLICABLE);
                }
                promotionId = promotionQuote.promotionId().toString();
                discount = MoneyUtil.roundVND(promotionQuote.discountAmount());
                finalAmount = MoneyUtil.nonNegative(MoneyUtil.roundVND(promotionQuote.finalAmount()));
            } catch (FeignException ex) {
                log.error("promotion-service quote failed: status={}", ex.status(), ex);
                throw new AppException(BookingErrorCode.PROMOTION_SERVICE_UNAVAILABLE);
            }
        }
        BookingQuote quote = BookingQuote.builder().quoteId(UUID.randomUUID().toString())
                .accountId(accountId).showtimeId(request.showtimeId()).movieId(map.movieId()).clusterId(map.clusterId())
                .promotionCode(normalizedCode).promotionId(promotionId).subtotalAmount(subtotal)
                .discountAmount(discount).finalAmount(finalAmount).currency("VND")
                .expiresAt(LocalDateTime.now().plusSeconds(quoteTtlSeconds)).status(BookingQuoteStatus.ACTIVE.name()).build();
        List<BookingQuoteItem> quoteItems = selectedSeats.stream().map(seat -> BookingQuoteItem.builder()
                .bookingQuote(quote).showtimeSeatId(seat.getSeatId()).seatCode(seat.getSeatCode())
                .unitPrice(seat.getPrice()).build()).toList();
        quote.setItems(new ArrayList<>(quoteItems));
        bookingQuoteRepository.save(quote);
        return new bookingservice.dto.response.BookingQuoteResponse(quote.getQuoteId(), quoteItems.stream()
                .map(item -> BookingItemResponse.builder().seatId(item.getShowtimeSeatId()).seatLabel(item.getSeatCode())
                .price(item.getUnitPrice()).build()).toList(), subtotal, discount, finalAmount,
                quote.getExpiresAt().atOffset(java.time.ZoneOffset.UTC));
    }

    private void validateHeldSelection(BookingRequest request, MovieSeatHoldResponse seatHold) {
        if (seatHold.getShowtimeId() == null
                || !seatHold.getShowtimeId().equals(request.getShowtimeId())
                || seatHold.getSeats() == null
                || seatHold.getExpiresAt() == null
                || seatHold.getHoldId() == null
                || !seatHold.getSeats().stream()
                        .map(HeldShowtimeSeatResponse::getSeatId)
                        .collect(java.util.stream.Collectors.toSet())
                        .equals(new java.util.HashSet<>(request.getSeatIds()))
                || seatHold.getSeats().stream()
                        .anyMatch(seat -> seat.getPrice() == null || seat.getSeatCode() == null)) {
            throw new AppException(BookingErrorCode.SHOWTIME_INVENTORY_UNAVAILABLE);
        }
    }

    /**
     * Chi sau khi Movie Service da tao seat hold va tra ve gia/movie authoritative
     * moi duoc quote + reserve promotion. Vi vay client khong the gia mao movieId,
     * subtotal hay discount. Reservation duoc tao truoc payment va snapshot duoc
     * ghi vao Booking mot lan de phuc vu refund/audit.
     */
    private void reservePromotionIfRequested(
            Booking booking,
            String promotionCode,
            MovieSeatHoldResponse seatHold,
            String accountId,
            String bookingIdempotencyKey,
            BookingQuote expectedQuote) {
        booking.setFinalAmount(booking.getTotalAmount());
        if (promotionCode == null || promotionCode.isBlank()) {
            return;
        }
        if (seatHold.getMovieId() == null) {
            // Khong fallback sang input UI neu Movie Service chua tra context cua showtime.
            throw new AppException(BookingErrorCode.SHOWTIME_INVENTORY_UNAVAILABLE);
        }

        PromotionQuoteRequest snapshot = new PromotionQuoteRequest(
                promotionCode.trim(), booking.getBookingId(), accountId,
                seatHold.getMovieId(), seatHold.getShowtimeId(), null,
                booking.getTotalAmount(), "VND");
        try {
            ApiResponse<bookingservice.dto.response.PromotionQuoteResponse> quoteResponse = promotionClient.quote(snapshot);
            bookingservice.dto.response.PromotionQuoteResponse quote = quoteResponse == null ? null : quoteResponse.getResult();
            if (quote == null) {
                throw new AppException(BookingErrorCode.PROMOTION_SERVICE_UNAVAILABLE);
            }
            if (!quote.eligible()) {
                if ("PROMOTION_QUOTA_EXHAUSTED".equals(quote.reasonCode())) {
                    throw new AppException(BookingErrorCode.PROMOTION_QUOTA_EXHAUSTED);
                }
                throw new AppException(BookingErrorCode.PROMOTION_NOT_APPLICABLE);
            }

            // Promotion Service lock quota va evaluate lai snapshot trong reserve,
            // nen quote pass van khong the lam vuot quota khi checkout dong thoi.
            ApiResponse<bookingservice.dto.response.PromotionReservationResponse> reserveResponse = promotionClient.reserve(
                    new PromotionReserveRequest("booking:" + bookingIdempotencyKey, snapshot));
            bookingservice.dto.response.PromotionReservationResponse reservation =
                    reserveResponse == null ? null : reserveResponse.getResult();
            if (reservation == null || reservation.reservationId() == null || reservation.promotionId() == null) {
                throw new AppException(BookingErrorCode.PROMOTION_SERVICE_UNAVAILABLE);
            }
            // Quotes promise a stable amount. A changed rule/discount must not
            // silently alter what the member saw, so release and ask for a new quote.
            if (expectedQuote != null
                    && (moneyValueChanged(reservation.subtotalAmount(), expectedQuote.getSubtotalAmount())
                    || moneyValueChanged(reservation.discountAmount(), expectedQuote.getDiscountAmount())
                    || moneyValueChanged(reservation.finalAmount(), expectedQuote.getFinalAmount()))) {
                promotionClient.release(reservation.reservationId());
                throw new AppException(BookingErrorCode.QUOTE_PRICE_CHANGED);
            }

            booking.setPromotionId(reservation.promotionId().toString());
            booking.setPromotionCode(promotionCode.trim().toUpperCase());
            booking.setPromotionReservationId(reservation.reservationId().toString());
            booking.setPromotionDiscountAmount(MoneyUtil.roundVND(reservation.discountAmount()));
            booking.setPromotionCurrency(reservation.currency());
            booking.setFinalAmount(MoneyUtil.nonNegative(MoneyUtil.roundVND(reservation.finalAmount())));
        } catch (FeignException ex) {
            // Reserve tra 409 khi quota da duoc request khac chiem giua quote va reserve.
            if (ex.status() == 409) {
                throw new AppException(BookingErrorCode.PROMOTION_QUOTA_EXHAUSTED);
            }
            log.error("promotion-service request failed: status={}", ex.status(), ex);
            throw new AppException(BookingErrorCode.PROMOTION_SERVICE_UNAVAILABLE);
        }
    }

    /** A quote is immutable: if Movie Service returns different prices, quote again. */
    private void validateQuotePriceSnapshot(BookingQuote quote, MovieSeatHoldResponse hold) {
        if (!quote.getShowtimeId().equals(hold.getShowtimeId()) || !quote.getMovieId().equals(hold.getMovieId())) {
            throw new AppException(BookingErrorCode.QUOTE_PRICE_CHANGED);
        }
        java.util.Map<Long, BigDecimal> quotedPrices = quote.getItems().stream()
                .collect(java.util.stream.Collectors.toMap(BookingQuoteItem::getShowtimeSeatId, BookingQuoteItem::getUnitPrice));
        boolean changed = hold.getSeats().stream().anyMatch(seat -> !seat.getPrice().equals(quotedPrices.get(seat.getSeatId())));
        if (changed || quotedPrices.size() != hold.getSeats().size()) {
            throw new AppException(BookingErrorCode.QUOTE_PRICE_CHANGED);
        }
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
        // Reservation chi duoc release khi booking chua thanh toan. Coupon da
        // COMMITTED can di qua refund policy rieng, khong tu dong tra quota.
        if (BookingStatus.PENDING.name().equalsIgnoreCase(currentStatus)
                && booking.getPromotionReservationId() != null) {
            releasePromotionReservation(booking.getPromotionReservationId());
        }

        booking.setStatus(BookingStatus.CANCELLED.name());
        booking.setUpdatedAt(LocalDateTime.now()); // Đảm bảo ghi nhận thời gian update mới nhất
        Booking bookingSave = bookingRepository.save(booking);

        // 8. [Confirm] Trả về dữ liệu map đúng Format yêu cầu
        return bookingMapper.toCancelBookingResponse(bookingSave);
    }

    /**
     * Payment orchestration invokes this after payment is confirmed. The
     * promotion reservation is committed before the booking becomes CONFIRMED,
     * so a failed commit cannot leave a paid booking with an uncounted coupon.
     */
    @Transactional(noRollbackFor = AppException.class)
    public CreateBookingResponse confirmBooking(String bookingId, boolean canConfirm) {
        if (!canConfirm) throw new AppException(BookingErrorCode.PAYMENT_CONFIRM_PERMISSION_DENIED);
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(BookingErrorCode.BOOKING_NOT_FOUND));
        if (BookingStatus.CONFIRMED.name().equals(booking.getStatus())) return toCreateResponse(booking);
        if (!BookingStatus.PENDING.name().equals(booking.getStatus())) {
            throw new AppException(BookingErrorCode.INVALID_BOOKING_STATE);
        }
        if (booking.getExpiresAt() != null && booking.getExpiresAt().isBefore(LocalDateTime.now())) {
            if (booking.getPromotionReservationId() != null) releasePromotionReservation(booking.getPromotionReservationId());
            booking.setStatus(BookingStatus.EXPIRED.name());
            throw new AppException(BookingErrorCode.QUOTE_EXPIRED);
        }
        if (booking.getPromotionReservationId() != null) {
            try {
                promotionClient.commit(UUID.fromString(booking.getPromotionReservationId()));
            } catch (FeignException ex) {
                log.error("cannot commit promotion reservation {}: status={}", booking.getPromotionReservationId(), ex.status(), ex);
                throw new AppException(BookingErrorCode.PROMOTION_SERVICE_UNAVAILABLE);
            }
        }
        booking.setStatus(BookingStatus.CONFIRMED.name());
        return toCreateResponse(bookingRepository.save(booking));
    }

    /** Called by the expiry sweep; release is idempotent in Promotion Service. */
    @Transactional
    public void expirePendingBooking(String bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(BookingErrorCode.BOOKING_NOT_FOUND));
        if (!BookingStatus.PENDING.name().equals(booking.getStatus())
                || booking.getExpiresAt() == null || booking.getExpiresAt().isAfter(LocalDateTime.now())) {
            return;
        }
        if (booking.getPromotionReservationId() != null) releasePromotionReservation(booking.getPromotionReservationId());
        booking.setStatus(BookingStatus.EXPIRED.name());
    }

    private CreateBookingResponse toCreateResponse(Booking booking) {
        List<BookingItemResponse> items = bookingItemRepository.findByBooking_BookingId(booking.getBookingId()).stream()
                .map(bookingMapper::toBookingItemResponse).toList();
        return bookingMapper.toCreateBookingResponse(booking, items, booking.getExpiresAt());
    }

    private void releasePromotionReservation(String reservationId) {
        try {
            promotionClient.release(UUID.fromString(reservationId));
        } catch (FeignException ex) {
            log.error("cannot release promotion reservation {}: status={}", reservationId, ex.status(), ex);
            throw new AppException(BookingErrorCode.PROMOTION_SERVICE_UNAVAILABLE);
        }
    }

    /** BigDecimal scale differs between JSON/DB representations; monetary equality is numeric equality. */
    private boolean moneyValueChanged(BigDecimal actual, BigDecimal expected) {
        return actual == null || expected == null || actual.compareTo(expected) != 0;
    }

    /** Cung idempotency key cua cung account phai quy ve cung booking ID khi retry. */
    private String deterministicBookingId(String accountId, String idempotencyKey) {
        return UUID.nameUUIDFromBytes((accountId + ":" + idempotencyKey)
                .getBytes(StandardCharsets.UTF_8)).toString();
    }

}
