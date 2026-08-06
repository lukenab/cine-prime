package bookingservice.controller;

import bookingservice.dto.request.CreateBookingRequest;
import bookingservice.dto.request.CancelBookingRequest;
import bookingservice.dto.request.AttachConcessionsRequest;
import bookingservice.dto.request.ApplyBookingPromotionRequest;
import bookingservice.dto.response.BookingDetailResponse;
import bookingservice.dto.response.CancellationResponse;
import bookingservice.dto.response.CreateBookingResponse;
import bookingservice.dto.response.TicketPassResponse;
import bookingservice.service.BookingOrchestrationService;
import bookingservice.service.BookingCancellationService;
import bookingservice.service.BookingQueryService;
import bookingservice.service.TicketPassService;
import bookingservice.service.ConcessionAttachService;
import bookingservice.service.BookingPromotionCheckoutService;
import bookingservice.service.BookingCheckoutLockService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import movie.theater.common.exception.AppException;
import movie.theater.common.security.JwtSecurityUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import static bookingservice.exception.BookingErrorCode.UNAUTHENTICATED;

@RestController
@RequestMapping("/api/bookings")
@RequiredArgsConstructor
public class BookingController {
    private final BookingOrchestrationService orchestrationService;
    private final BookingCancellationService cancellationService;
    private final BookingQueryService queryService;
    private final TicketPassService ticketPassService;
    private final ConcessionAttachService concessionAttachService;
    private final BookingPromotionCheckoutService promotionCheckoutService;
    private final BookingCheckoutLockService checkoutLockService;

    @PostMapping
    public ResponseEntity<ApiResponse<CreateBookingResponse>> create(
            @RequestHeader("Authorization") String authorization,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody CreateBookingRequest request) {
        String accountId = requireAccountId();
        CreateBookingResponse response = orchestrationService.create(
                accountId,
                authorization,
                idempotencyKey,
                request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.<CreateBookingResponse>builder()
                        .message("Seats are held and the booking is awaiting payment.")
                        .result(response)
                        .build());
    }

    @GetMapping("/{bookingId}")
    public ApiResponse<BookingDetailResponse> get(@PathVariable String bookingId) {
        return ApiResponse.<BookingDetailResponse>builder()
                .result(queryService.getOwnedBooking(bookingId, requireAccountId()))
                .build();
    }

    @GetMapping
    public ApiResponse<Page<BookingDetailResponse>> history(Pageable pageable) {
        return ApiResponse.<Page<BookingDetailResponse>>builder()
                .result(queryService.getOwnedBookings(requireAccountId(), pageable))
                .build();
    }

    @GetMapping("/{bookingId}/ticket-pass")
    public ApiResponse<TicketPassResponse> ticketPass(@PathVariable String bookingId) {
        return ApiResponse.<TicketPassResponse>builder()
                .result(ticketPassService.getOwnedPass(bookingId, requireAccountId()))
                .build();
    }

    @PostMapping("/{bookingId}/cancellations")
    public ApiResponse<CancellationResponse> cancel(
            @PathVariable String bookingId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody CancelBookingRequest request) {
        return ApiResponse.<CancellationResponse>builder()
                .message("Cancellation request accepted.")
                .result(cancellationService.cancel(
                        bookingId,
                        requireAccountId(),
                        idempotencyKey,
                        request))
                .build();
    }

    @PostMapping("/{bookingId}/concessions")
    public ApiResponse<BookingDetailResponse> attachConcessions(
            @PathVariable String bookingId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody AttachConcessionsRequest request) {
        return ApiResponse.<BookingDetailResponse>builder()
                .message("Concession items are reserved and included in checkout.")
                .result(concessionAttachService.attach(
                        bookingId, requireAccountId(), idempotencyKey, request))
                .build();
    }

    @PutMapping("/{bookingId}/promotion")
    public ApiResponse<BookingDetailResponse> applyPromotion(
            @PathVariable String bookingId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody ApplyBookingPromotionRequest request) {
        return ApiResponse.<BookingDetailResponse>builder()
                .message("Promotion reserved and checkout total updated.")
                .result(promotionCheckoutService.apply(
                        bookingId,
                        requireAccountId(),
                        idempotencyKey,
                        request.promotionCode()))
                .build();
    }

    @DeleteMapping("/{bookingId}/promotion")
    public ApiResponse<BookingDetailResponse> removePromotion(
            @PathVariable String bookingId) {
        return ApiResponse.<BookingDetailResponse>builder()
                .message("Promotion removed and checkout total updated.")
                .result(promotionCheckoutService.remove(bookingId, requireAccountId()))
                .build();
    }

    @PostMapping("/{bookingId}/checkout-lock")
    public ApiResponse<BookingDetailResponse> lockCheckout(
            @PathVariable String bookingId) {
        return ApiResponse.<BookingDetailResponse>builder()
                .message("Checkout pricing is locked for payment.")
                .result(checkoutLockService.lock(bookingId, requireAccountId()))
                .build();
    }

    private String requireAccountId() {
        String accountId = JwtSecurityUtils.getCurrentAccountId();
        if (accountId == null || accountId.isBlank()) {
            throw new AppException(UNAUTHENTICATED);
        }
        return accountId;
    }
}
