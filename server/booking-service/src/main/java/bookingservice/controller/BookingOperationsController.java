package bookingservice.controller;

import bookingservice.dto.request.TicketCheckInRequest;
import bookingservice.dto.request.CounterSaleRequest;
import bookingservice.dto.response.BookingDetailResponse;
import bookingservice.dto.response.ReconciliationCaseResponse;
import bookingservice.dto.response.TicketCheckInResponse;
import bookingservice.dto.response.CounterSaleResponse;
import bookingservice.service.BookingClusterAccessPolicy;
import bookingservice.service.BookingQueryService;
import bookingservice.service.BookingReconciliationService;
import bookingservice.service.TicketPassService;
import bookingservice.service.CounterSaleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import movie.theater.common.exception.AppException;
import movie.theater.common.security.JwtSecurityUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import static bookingservice.exception.BookingErrorCode.UNAUTHENTICATED;

@RestController
@RequestMapping("/api/booking-operations")
@RequiredArgsConstructor
public class BookingOperationsController {
    private final BookingQueryService queryService;
    private final BookingReconciliationService reconciliationService;
    private final BookingClusterAccessPolicy clusterAccessPolicy;
    private final TicketPassService ticketPassService;
    private final CounterSaleService counterSaleService;

    @GetMapping("/clusters/{clusterId}/bookings")
    @PreAuthorize("hasAnyRole('ADMIN','EMPLOYEE')")
    public ApiResponse<Page<BookingDetailResponse>> clusterBookings(
            @PathVariable Long clusterId,
            Pageable pageable) {
        clusterAccessPolicy.requireAccess(clusterId);
        return ApiResponse.<Page<BookingDetailResponse>>builder()
                .result(queryService.getClusterBookings(clusterId, pageable))
                .build();
    }

    @GetMapping("/clusters/{clusterId}/reconciliation-cases")
    @PreAuthorize("hasAnyRole('ADMIN','EMPLOYEE')")
    public ApiResponse<Page<ReconciliationCaseResponse>> reconciliationCases(
            @PathVariable Long clusterId,
            Pageable pageable) {
        clusterAccessPolicy.requireAccess(clusterId);
        return ApiResponse.<Page<ReconciliationCaseResponse>>builder()
                .result(reconciliationService.getClusterCases(clusterId, pageable))
                .build();
    }

    @PostMapping("/clusters/{clusterId}/check-ins")
    @PreAuthorize("hasAnyRole('ADMIN','EMPLOYEE')")
    public ApiResponse<TicketCheckInResponse> checkIn(
            @PathVariable Long clusterId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody TicketCheckInRequest request) {
        clusterAccessPolicy.requireAccess(clusterId);
        return ApiResponse.<TicketCheckInResponse>builder()
                .message("Ticket check-in accepted.")
                .result(ticketPassService.checkIn(
                        clusterId,
                        requireAccountId(),
                        idempotencyKey,
                        request))
                .build();
    }

    @PostMapping("/clusters/{clusterId}/counter-sales")
    @PreAuthorize("hasAnyRole('ADMIN','EMPLOYEE')")
    public ApiResponse<CounterSaleResponse> counterSale(
            @PathVariable Long clusterId,
            @RequestHeader("Authorization") String authorization,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody CounterSaleRequest request) {
        clusterAccessPolicy.requireAccess(clusterId);
        return ApiResponse.<CounterSaleResponse>builder()
                .message("Counter sale confirmed.")
                .result(counterSaleService.create(
                        clusterId,
                        requireAccountId(),
                        authorization,
                        idempotencyKey,
                        request))
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
