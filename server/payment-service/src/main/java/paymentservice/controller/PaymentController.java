package paymentservice.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import paymentservice.dto.CreatePaymentSessionRequest;
import paymentservice.dto.InternalRefundRequest;
import paymentservice.dto.PaymentRefundResponse;
import paymentservice.dto.PaymentSessionResponse;
import paymentservice.dto.ReconciliationCaseResponse;
import paymentservice.service.PaymentApplicationService;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {
    private final PaymentApplicationService paymentService;

    @PostMapping("/sessions")
    public ResponseEntity<ApiResponse<PaymentSessionResponse>> createSession(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody CreatePaymentSessionRequest request,
            HttpServletRequest servletRequest) {
        String clientIp = servletRequest.getHeader("X-Forwarded-For");
        if (clientIp == null || clientIp.isBlank()) {
            clientIp = servletRequest.getRemoteAddr();
        }
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.<PaymentSessionResponse>builder()
                        .message("VNPAY payment session created.")
                        .result(paymentService.createSession(
                                authorization, idempotencyKey, request, clientIp))
                        .build());
    }

    @GetMapping("/{paymentId}")
    public ApiResponse<PaymentSessionResponse> get(
            @PathVariable String paymentId) {
        return ApiResponse.<PaymentSessionResponse>builder()
                .result(paymentService.getOwned(paymentId))
                .build();
    }

    @GetMapping("/by-booking/{bookingId}")
    public ApiResponse<PaymentSessionResponse> getByBooking(
            @PathVariable String bookingId) {
        return ApiResponse.<PaymentSessionResponse>builder()
                .result(paymentService.getByBooking(bookingId))
                .build();
    }

    @GetMapping("/vnpay/ipn")
    public Map<String, String> vnpayIpn(
            @RequestParam Map<String, String> parameters) {
        PaymentApplicationService.ProviderCallbackResult result =
                paymentService.processVnpayCallback(parameters);
        Map<String, String> response = new LinkedHashMap<>();
        response.put("RspCode", result.responseCode());
        response.put("Message", result.message());
        return response;
    }

    @GetMapping("/vnpay/return")
    public ResponseEntity<Void> vnpayReturn(
            @RequestParam Map<String, String> parameters) {
        PaymentApplicationService.ProviderCallbackResult result =
                paymentService.processVnpayCallback(parameters);
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(paymentService.checkoutRedirect(result)))
                .build();
    }

    @GetMapping("/admin/attempts")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public ApiResponse<Page<PaymentSessionResponse>> attempts(Pageable pageable) {
        return ApiResponse.<Page<PaymentSessionResponse>>builder()
                .result(paymentService.listAttempts(pageable))
                .build();
    }

    @GetMapping("/admin/reconciliation")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public ApiResponse<Page<ReconciliationCaseResponse>> reconciliation(
            Pageable pageable) {
        return ApiResponse.<Page<ReconciliationCaseResponse>>builder()
                .result(paymentService.listOpenReconciliation(pageable))
                .build();
    }

    @PostMapping("/internal/refunds")
    public ApiResponse<PaymentRefundResponse> refund(
            @RequestHeader("X-Internal-Service-Key") String internalServiceKey,
            @Valid @RequestBody InternalRefundRequest request) {
        return ApiResponse.<PaymentRefundResponse>builder()
                .message("Refund request processed.")
                .result(paymentService.refund(internalServiceKey, request))
                .build();
    }
}
