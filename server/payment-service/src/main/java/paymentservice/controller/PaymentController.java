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
import paymentservice.dto.RefundApprovalCommandRequest;
import paymentservice.dto.RefundApprovalResponse;
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
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','PAYMENT_READ')")
    public ApiResponse<Page<PaymentSessionResponse>> attempts(Pageable pageable) {
        return ApiResponse.<Page<PaymentSessionResponse>>builder()
                .result(paymentService.listAttempts(pageable))
                .build();
    }

    @GetMapping("/admin/reconciliation")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','RECONCILIATION_READ')")
    public ApiResponse<Page<ReconciliationCaseResponse>> reconciliation(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) String bookingId,
            Pageable pageable) {
        return ApiResponse.<Page<ReconciliationCaseResponse>>builder()
                .result(paymentService.listAdminReconciliation(status, severity, bookingId, pageable))
                .build();
    }

    @GetMapping("/admin/refunds")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','REFUND_READ')")
    public ApiResponse<Page<PaymentRefundResponse>> refunds(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String bookingId,
            Pageable pageable) {
        return ApiResponse.<Page<PaymentRefundResponse>>builder()
                .result(paymentService.listAdminRefunds(status, bookingId, pageable))
                .build();
    }

    @GetMapping("/admin/refunds/{refundId}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','REFUND_READ')")
    public ApiResponse<PaymentRefundResponse> refundDetail(@PathVariable String refundId) {
        return ApiResponse.<PaymentRefundResponse>builder()
                .result(paymentService.getAdminRefund(refundId))
                .build();
    }

    @PostMapping("/admin/refunds/{refundId}/retry")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN')")
    public ApiResponse<PaymentRefundResponse> retryRefund(@PathVariable String refundId) {
        return ApiResponse.<PaymentRefundResponse>builder()
                .message("Refund retry submitted.")
                .result(paymentService.retryRefund(refundId))
                .build();
    }

    @GetMapping("/admin/refund-approval-requests")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','REFUND_READ')")
    public ApiResponse<Page<RefundApprovalResponse>> refundApprovalRequests(
            @RequestParam(required = false) String status, Pageable pageable) {
        return ApiResponse.<Page<RefundApprovalResponse>>builder()
                .result(paymentService.listRefundApprovals(status, pageable)).build();
    }

    @GetMapping("/admin/refund-approval-requests/{requestId}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','REFUND_READ')")
    public ApiResponse<RefundApprovalResponse> refundApprovalRequest(@PathVariable String requestId) {
        return ApiResponse.<RefundApprovalResponse>builder()
                .result(paymentService.getRefundApproval(requestId)).build();
    }

    @GetMapping("/admin/refunds/{refundId}/approval-request")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','REFUND_READ')")
    public ApiResponse<RefundApprovalResponse> latestRefundApproval(@PathVariable String refundId) {
        return ApiResponse.<RefundApprovalResponse>builder()
                .result(paymentService.getLatestRefundApproval(refundId)).build();
    }

    @PostMapping("/admin/refunds/{refundId}/approval-requests")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','REFUND_REVIEW')")
    public ApiResponse<RefundApprovalResponse> createRefundApproval(
            @PathVariable String refundId,
            @Valid @RequestBody(required = false) RefundApprovalCommandRequest request) {
        return ApiResponse.<RefundApprovalResponse>builder()
                .message("Refund approval draft created.")
                .result(paymentService.createRefundApprovalDraft(refundId, request == null ? null : request.getNote()))
                .build();
    }

    @PostMapping("/admin/refund-approval-requests/{requestId}/submit")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','REFUND_REVIEW')")
    public ApiResponse<RefundApprovalResponse> submitRefundApproval(@PathVariable String requestId) {
        return ApiResponse.<RefundApprovalResponse>builder().message("Refund approval submitted.")
                .result(paymentService.submitRefundApproval(requestId)).build();
    }

    @PostMapping("/admin/refund-approval-requests/{requestId}/approve")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','REFUND_APPROVE')")
    public ApiResponse<RefundApprovalResponse> approveRefundApproval(
            @PathVariable String requestId,
            @Valid @RequestBody(required = false) RefundApprovalCommandRequest request) {
        return ApiResponse.<RefundApprovalResponse>builder().message("Refund approval approved.")
                .result(paymentService.approveRefundApproval(requestId, request == null ? null : request.getNote())).build();
    }

    @PostMapping("/admin/refund-approval-requests/{requestId}/reject")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','REFUND_APPROVE')")
    public ApiResponse<RefundApprovalResponse> rejectRefundApproval(
            @PathVariable String requestId,
            @Valid @RequestBody(required = false) RefundApprovalCommandRequest request) {
        return ApiResponse.<RefundApprovalResponse>builder().message("Refund approval rejected.")
                .result(paymentService.rejectRefundApproval(requestId, request == null ? null : request.getNote())).build();
    }

    @PostMapping("/admin/refund-approval-requests/{requestId}/execute")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','REFUND_REVIEW')")
    public ApiResponse<RefundApprovalResponse> executeRefundApproval(@PathVariable String requestId) {
        return ApiResponse.<RefundApprovalResponse>builder().message("Approved refund execution submitted.")
                .result(paymentService.executeRefundApproval(requestId)).build();
    }

    @PostMapping("/admin/reconciliation/{caseId}/sync")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','RECONCILIATION_RESOLVE')")
    public ApiResponse<ReconciliationCaseResponse> syncReconciliation(
            @PathVariable Long caseId) {
        return ApiResponse.<ReconciliationCaseResponse>builder()
                .message("Reconciliation sync requested.")
                .result(paymentService.syncReconciliationCase(caseId))
                .build();
    }

    @PostMapping("/admin/reconciliation/{caseId}/resolve")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','RECONCILIATION_RESOLVE')")
    public ApiResponse<ReconciliationCaseResponse> resolveReconciliation(
            @PathVariable Long caseId,
            @Valid @RequestBody(required = false) paymentservice.dto.AdminResolutionRequest request) {
        return ApiResponse.<ReconciliationCaseResponse>builder()
                .message("Reconciliation case resolved.")
                .result(paymentService.resolveReconciliationCase(
                        caseId, request == null ? null : request.getNote()))
                .build();
    }

    @PostMapping("/admin/reconciliation/{caseId}/escalate")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','RECONCILIATION_RESOLVE')")
    public ApiResponse<ReconciliationCaseResponse> escalateReconciliation(
            @PathVariable Long caseId,
            @Valid @RequestBody(required = false) paymentservice.dto.AdminResolutionRequest request) {
        return ApiResponse.<ReconciliationCaseResponse>builder()
                .message("Reconciliation case escalated for manual review.")
                .result(paymentService.escalateReconciliationCase(
                        caseId, request == null ? null : request.getNote()))
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
