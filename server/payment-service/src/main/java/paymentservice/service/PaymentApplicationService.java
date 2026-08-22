package paymentservice.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import movie.theater.common.security.JwtSecurityUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import paymentservice.client.BookingGateway;
import paymentservice.config.PaymentProperties;
import paymentservice.config.VnpayProperties;
import paymentservice.dto.*;
import paymentservice.entity.*;
import paymentservice.provider.VnpaySigner;
import paymentservice.provider.ProviderRefundGateway;
import paymentservice.provider.ProviderRefundResult;
import paymentservice.repository.PaymentAttemptRepository;
import paymentservice.repository.PaymentEventInboxRepository;
import paymentservice.repository.PaymentReconciliationCaseRepository;
import paymentservice.repository.PaymentRefundRepository;
import paymentservice.repository.RefundApprovalRequestRepository;
import paymentservice.util.PaymentHashing;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.sql.PreparedStatement;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

import static paymentservice.exception.PaymentErrorCode.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentApplicationService {
    private static final String PROVIDER = "VNPAY";
    private static final DateTimeFormatter VNPAY_TIME =
            DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final PaymentAttemptRepository attemptRepository;
    private final PaymentEventInboxRepository inboxRepository;
    private final PaymentReconciliationCaseRepository reconciliationRepository;
    private final PaymentRefundRepository refundRepository;
    private final RefundApprovalRequestRepository refundApprovalRepository;
    private final BookingGateway bookingGateway;
    private final VnpaySigner vnpaySigner;
    private final VnpayProperties vnpayProperties;
    private final PaymentProperties paymentProperties;
    private final PaymentOutcomePublisher outcomePublisher;
    private final ProviderRefundGateway providerRefundGateway;
    private final JdbcTemplate jdbcTemplate;

    @Transactional
    public PaymentSessionResponse createSession(
            String authorization,
            String idempotencyKey,
            CreatePaymentSessionRequest request,
            String clientIp) {
        String accountId = requireAccountId();
        requireText(idempotencyKey);
        if (!vnpayProperties.configured()) {
            throw new AppException(PROVIDER_NOT_CONFIGURED);
        }

        BookingSnapshot booking = bookingGateway.lockOwnedCheckout(
                request.getBookingId(), authorization);
        validatePayable(booking);
        String requestHash = requestHash(booking);

        PaymentAttempt idempotent = attemptRepository
                .findByAccountIdAndIdempotencyKey(accountId, idempotencyKey)
                .orElse(null);
        if (idempotent != null) {
            if (!idempotent.getRequestHash().equals(requestHash)) {
                throw new AppException(IDEMPOTENCY_CONFLICT);
            }
            return response(idempotent);
        }

        PaymentAttempt reusable = attemptRepository
                .findFirstByBookingIdAndAccountIdOrderByCreatedAtDesc(
                        booking.getBookingId(), accountId)
                .filter(this::isReusable)
                .orElse(null);
        if (reusable != null) {
            return response(reusable);
        }

        int maxPerMinute = Math.max(
                paymentProperties.rateGuard().maxSessionsPerMinute(), 1);
        if (attemptRepository.countByAccountIdAndCreatedAtAfter(
                accountId, OffsetDateTime.now().minusMinutes(1)) >= maxPerMinute) {
            throw new AppException(RATE_LIMITED);
        }

        OffsetDateTime now = OffsetDateTime.now();
        String paymentId = "PAY-" + UUID.randomUUID();
        String txnRef = "CP" + UUID.randomUUID()
                .toString().replace("-", "").substring(0, 20).toUpperCase(Locale.ROOT);
        PaymentAttempt attempt = PaymentAttempt.builder()
                .paymentId(paymentId)
                .bookingId(booking.getBookingId())
                .accountId(accountId)
                .provider(PROVIDER)
                .providerTxnRef(txnRef)
                .providerCreatedAt(now)
                .idempotencyKey(idempotencyKey)
                .requestHash(requestHash)
                .amount(money(booking.getTotal()))
                .currency(booking.getCurrency().toUpperCase(Locale.ROOT))
                .status(PaymentStatus.INITIATED)
                .expiresAt(min(now.plus(paymentProperties.sessionTtl()), booking.getExpiresAt()))
                .build();
        attemptRepository.save(attempt);

        String paymentUrl = vnpaySigner.buildPaymentUrl(
                createVnpayParameters(attempt, clientIp, now));
        attempt.setPaymentUrl(paymentUrl);
        attempt.setStatus(PaymentStatus.PENDING);
        return response(attempt);
    }

    @Transactional(readOnly = true)
    public PaymentSessionResponse getOwned(String paymentId) {
        PaymentAttempt attempt = attemptRepository.findById(paymentId)
                .orElseThrow(() -> new AppException(PAYMENT_NOT_FOUND));
        assertOwner(attempt);
        return response(attempt);
    }

    @Transactional(readOnly = true)
    public PaymentSessionResponse getByBooking(String bookingId) {
        PaymentAttempt attempt = attemptRepository
                .findFirstByBookingIdAndAccountIdOrderByCreatedAtDesc(
                        bookingId, requireAccountId())
                .orElseThrow(() -> new AppException(PAYMENT_NOT_FOUND));
        return response(attempt);
    }

    @Transactional
    public ProviderCallbackResult processVnpayCallback(Map<String, String> parameters) {
        if (!vnpayProperties.configured() || !vnpaySigner.valid(parameters)) {
            return new ProviderCallbackResult("97", "Invalid signature", null, null);
        }

        String txnRef = parameters.get("vnp_TxnRef");
        PaymentAttempt attempt = attemptRepository.findByProviderTxnRefForUpdate(txnRef)
                .orElse(null);
        if (attempt == null) {
            return new ProviderCallbackResult("01", "Payment not found", null, null);
        }

        long providerMinorAmount;
        try {
            providerMinorAmount = Long.parseLong(parameters.getOrDefault("vnp_Amount", "-1"));
        } catch (NumberFormatException exception) {
            providerMinorAmount = -1;
        }
        long expectedMinorAmount = attempt.getAmount()
                .multiply(BigDecimal.valueOf(100))
                .setScale(0, RoundingMode.HALF_UP)
                .longValueExact();
        if (providerMinorAmount != expectedMinorAmount) {
            recordInbox(attempt, parameters, InboxProcessingStatus.REJECTED, "04");
            return new ProviderCallbackResult(
                    "04", "Invalid amount", attempt.getBookingId(), attempt.getStatus().name());
        }

        String eventKey = callbackEventKey(parameters);
        PaymentEventInbox duplicate = inboxRepository
                .findByProviderAndEventKey(PROVIDER, eventKey)
                .orElse(null);
        if (duplicate != null) {
            return new ProviderCallbackResult(
                    "02", "Callback already processed",
                    attempt.getBookingId(), attempt.getStatus().name());
        }

        boolean paid = "00".equals(parameters.get("vnp_ResponseCode"))
                && "00".equals(parameters.getOrDefault("vnp_TransactionStatus", "00"));
        OffsetDateTime occurredAt = parseProviderTime(parameters.get("vnp_PayDate"));
        attempt.setProviderTransactionId(parameters.get("vnp_TransactionNo"));
        attempt.setFailureCode(paid ? null : parameters.get("vnp_ResponseCode"));
        attempt.setFailureMessage(paid ? null : "VNPAY declined or cancelled the transaction.");
        attempt.setPaidAt(paid ? occurredAt : null);
        attempt.setBankCode(parameters.get("vnp_BankCode"));
        attempt.setCardType(parameters.get("vnp_CardType"));
        attempt.setStatus(paid ? PaymentStatus.PAID : PaymentStatus.FAILED);
        prepareOutcome(attempt, paid ? "PAYMENT_SUCCEEDED" : "PAYMENT_FAILED", occurredAt);
        recordInbox(attempt, parameters, InboxProcessingStatus.PROCESSED, "00");
        deliverOutcome(attempt);
        return new ProviderCallbackResult(
                "00", "Callback processed", attempt.getBookingId(), attempt.getStatus().name());
    }

    @Transactional
    public void expireDueSessions() {
        List<PaymentAttempt> due = attemptRepository.findByStatusAndExpiresAtBefore(
                PaymentStatus.PENDING, OffsetDateTime.now(), PageRequest.of(0, 100));
        for (PaymentAttempt attempt : due) {
            attempt.setStatus(PaymentStatus.EXPIRED);
            attempt.setFailureCode("SESSION_EXPIRED");
            attempt.setFailureMessage("Payment session expired before payment confirmation.");
            prepareOutcome(attempt, "PAYMENT_FAILED", OffsetDateTime.now());
            deliverOutcome(attempt);
        }
    }

    @Transactional
    public void retryOutcomeDelivery() {
        List<PaymentAttempt> due = attemptRepository.findDeliveryDue(
                OffsetDateTime.now(), PageRequest.of(0, 100));
        for (PaymentAttempt attempt : due) {
            deliverOutcome(attempt);
        }
    }

    @Transactional(readOnly = true)
    public Page<PaymentSessionResponse> listAttempts(Pageable pageable) {
        return attemptRepository.findAllByOrderByCreatedAtDesc(pageable)
                .map(this::response);
    }

    @Transactional(readOnly = true)
    public Page<ReconciliationCaseResponse> listOpenReconciliation(Pageable pageable) {
        return listAdminReconciliation("OPEN", null, null, pageable);
    }

    @Transactional(readOnly = true)
    public Page<PaymentRefundResponse> listAdminRefunds(
            String status, String bookingId, Pageable pageable) {
        PaymentRefundStatus parsedStatus = parseEnum(status, PaymentRefundStatus.class);
        String normalizedBookingId = normalizeFilter(bookingId);
        return refundRepository.search(parsedStatus, normalizedBookingId, pageable)
                .map(item -> refundResponse(item, false));
    }

    @Transactional(readOnly = true)
    public PaymentRefundResponse getAdminRefund(String refundId) {
        PaymentRefund refund = refundRepository.findById(refundId)
                .orElseThrow(() -> new AppException(REFUND_NOT_FOUND));
        return refundResponse(refund, false);
    }

    @Transactional
    public PaymentRefundResponse retryRefund(String refundId) {
        PaymentRefund refund = refundRepository.findById(refundId)
                .orElseThrow(() -> new AppException(REFUND_NOT_FOUND));
        if (refund.getStatus() == PaymentRefundStatus.SUCCEEDED) {
            return refundResponse(refund, true);
        }

        PaymentAttempt attempt = refund.getPayment();
        if (paymentProperties.refund().sandboxAutoApprove()) {
            refund.setStatus(PaymentRefundStatus.SUCCEEDED);
            refund.setProviderRefundReference(
                    refund.getProviderRefundReference() == null
                            ? "SANDBOX-REF-" + UUID.randomUUID()
                            : refund.getProviderRefundReference());
            refund.setCompletedAt(OffsetDateTime.now());
            attempt.setStatus(PaymentStatus.REFUNDED);
        } else {
            applyProviderRefundResult(
                    attempt, refund, providerRefundGateway.submit(attempt, refund));
        }
        refundRepository.save(refund);
        if (refund.getStatus() == PaymentRefundStatus.SUCCEEDED) {
            resolveOpenCasesForPayment(attempt.getPaymentId(),
                    "Refund provider confirmation received.");
        }
        return refundResponse(refund, false);
    }

    @Transactional(readOnly = true)
    public Page<RefundApprovalResponse> listRefundApprovals(String status, Pageable pageable) {
        RefundApprovalStatus parsed = parseEnum(status, RefundApprovalStatus.class);
        Page<RefundApprovalRequest> page = parsed == null
                ? refundApprovalRepository.findAllByOrderByCreatedAtDesc(pageable)
                : refundApprovalRepository.findAllByStatusOrderByCreatedAtDesc(parsed, pageable);
        return page.map(this::refundApprovalResponse);
    }

    @Transactional(readOnly = true)
    public RefundApprovalResponse getRefundApproval(String requestId) {
        return refundApprovalResponse(findRefundApproval(requestId));
    }

    @Transactional(readOnly = true)
    public RefundApprovalResponse getLatestRefundApproval(String refundId) {
        return refundApprovalRepository.findFirstByRefund_RefundIdOrderByCreatedAtDesc(refundId)
                .map(this::refundApprovalResponse)
                .orElse(null);
    }

    @Transactional
    public RefundApprovalResponse createRefundApprovalDraft(String refundId, String note) {
        PaymentRefund refund = refundRepository.findById(refundId)
                .orElseThrow(() -> new AppException(REFUND_NOT_FOUND));
        if (refund.getStatus() == PaymentRefundStatus.SUCCEEDED) {
            throw new AppException(REFUND_NOT_ALLOWED);
        }
        refundApprovalRepository.findFirstByRefund_RefundIdOrderByCreatedAtDesc(refundId)
                .filter(item -> item.getStatus() != RefundApprovalStatus.REJECTED
                        && item.getStatus() != RefundApprovalStatus.EXECUTED)
                .ifPresent(item -> { throw new AppException(REFUND_APPROVAL_ALREADY_ACTIVE); });
        RefundApprovalRequest item = RefundApprovalRequest.builder()
                .refund(refund)
                .status(RefundApprovalStatus.DRAFT)
                .requestedBy(requireAccountId())
                .requestNote(normalizeOptionalNote(note))
                .build();
        try {
            return refundApprovalResponse(refundApprovalRepository.saveAndFlush(item));
        } catch (DataIntegrityViolationException conflict) {
            throw new AppException(REFUND_APPROVAL_ALREADY_ACTIVE);
        }
    }

    @Transactional
    public RefundApprovalResponse submitRefundApproval(String requestId) {
        RefundApprovalRequest item = findRefundApproval(requestId);
        requireApprovalState(item, RefundApprovalStatus.DRAFT);
        requireRequester(item);
        item.setStatus(RefundApprovalStatus.SUBMITTED);
        item.setSubmittedAt(OffsetDateTime.now());
        return refundApprovalResponse(refundApprovalRepository.save(item));
    }

    @Transactional
    public RefundApprovalResponse approveRefundApproval(String requestId, String note) {
        RefundApprovalRequest item = findRefundApproval(requestId);
        requireApprovalState(item, RefundApprovalStatus.SUBMITTED);
        String actor = requireAccountId();
        if (actor.equals(item.getRequestedBy())) {
            throw new AppException(REFUND_SELF_APPROVAL_FORBIDDEN);
        }
        item.setStatus(RefundApprovalStatus.APPROVED);
        item.setReviewedBy(actor);
        item.setDecisionNote(normalizeOptionalNote(note));
        item.setReviewedAt(OffsetDateTime.now());
        return refundApprovalResponse(refundApprovalRepository.save(item));
    }

    @Transactional
    public RefundApprovalResponse rejectRefundApproval(String requestId, String note) {
        RefundApprovalRequest item = findRefundApproval(requestId);
        requireApprovalState(item, RefundApprovalStatus.SUBMITTED);
        String actor = requireAccountId();
        if (actor.equals(item.getRequestedBy())) {
            throw new AppException(REFUND_SELF_APPROVAL_FORBIDDEN);
        }
        item.setStatus(RefundApprovalStatus.REJECTED);
        item.setReviewedBy(actor);
        item.setDecisionNote(normalizeOptionalNote(note));
        item.setReviewedAt(OffsetDateTime.now());
        return refundApprovalResponse(refundApprovalRepository.save(item));
    }

    @Transactional
    public RefundApprovalResponse executeRefundApproval(String requestId) {
        RefundApprovalRequest item = findRefundApproval(requestId);
        requireApprovalState(item, RefundApprovalStatus.APPROVED);
        retryRefund(item.getRefund().getRefundId());
        item.setStatus(RefundApprovalStatus.EXECUTED);
        item.setExecutedBy(requireAccountId());
        item.setExecutedAt(OffsetDateTime.now());
        return refundApprovalResponse(refundApprovalRepository.save(item));
    }

    private RefundApprovalRequest findRefundApproval(String requestId) {
        return refundApprovalRepository.findById(requestId)
                .orElseThrow(() -> new AppException(REFUND_APPROVAL_NOT_FOUND));
    }

    private void requireApprovalState(RefundApprovalRequest item, RefundApprovalStatus expected) {
        if (item.getStatus() != expected) throw new AppException(REFUND_APPROVAL_INVALID_STATE);
    }

    private void requireRequester(RefundApprovalRequest item) {
        if (!requireAccountId().equals(item.getRequestedBy())) {
            throw new AppException(PAYMENT_FORBIDDEN);
        }
    }

    private String normalizeOptionalNote(String note) {
        if (note == null || note.isBlank()) return null;
        String normalized = note.trim();
        return normalized.length() > 1000 ? normalized.substring(0, 1000) : normalized;
    }

    private RefundApprovalResponse refundApprovalResponse(RefundApprovalRequest item) {
        return RefundApprovalResponse.builder()
                .requestId(item.getRequestId())
                .refundId(item.getRefund().getRefundId())
                .bookingId(item.getRefund().getBookingId())
                .status(item.getStatus().name())
                .requestedBy(item.getRequestedBy())
                .reviewedBy(item.getReviewedBy())
                .executedBy(item.getExecutedBy())
                .requestNote(item.getRequestNote())
                .decisionNote(item.getDecisionNote())
                .submittedAt(item.getSubmittedAt())
                .reviewedAt(item.getReviewedAt())
                .executedAt(item.getExecutedAt())
                .createdAt(item.getCreatedAt())
                .updatedAt(item.getUpdatedAt())
                .build();
    }

    @Transactional(readOnly = true)
    public Page<ReconciliationCaseResponse> listAdminReconciliation(
            String status, String severity, String bookingId, Pageable pageable) {
        ReconciliationStatus parsedStatus = parseEnum(status, ReconciliationStatus.class);
        String normalizedSeverity = normalizeFilter(severity);
        if (normalizedSeverity != null) {
            normalizedSeverity = normalizedSeverity.toUpperCase(Locale.ROOT);
        }
        return reconciliationRepository.search(
                        parsedStatus, normalizedSeverity, normalizeFilter(bookingId), pageable)
                .map(this::reconciliationResponse);
    }

    @Transactional
    public ReconciliationCaseResponse syncReconciliationCase(Long caseId) {
        PaymentReconciliationCase item = reconciliationRepository.findById(caseId)
                .orElseThrow(() -> new AppException(RECONCILIATION_CASE_NOT_FOUND));
        if (item.getStatus() == ReconciliationStatus.RESOLVED) {
            throw new AppException(RECONCILIATION_CASE_INVALID_STATE);
        }

        item.setStatus(ReconciliationStatus.RETRYING);
        item.setAttemptCount(item.getAttemptCount() + 1);
        item.setNextAttemptAt(OffsetDateTime.now().plusMinutes(5));
        PaymentRefund latestRefund = refundRepository
                .findFirstByPayment_PaymentIdOrderByCreatedAtDesc(item.getPaymentId())
                .orElse(null);
        if (latestRefund != null && latestRefund.getStatus() == PaymentRefundStatus.SUCCEEDED) {
            item.setStatus(ReconciliationStatus.RESOLVED);
            item.setResolvedAt(OffsetDateTime.now());
            item.setResolvedBy(adminActor());
            item.setResolutionNote("Ledger already contains a successful refund.");
            item.setNextAttemptAt(null);
        } else {
            item.setStatus(ReconciliationStatus.OPEN);
            item.setDetails(item.getDetails() + " Manual sync requested by " + adminActor() + ".");
        }
        return reconciliationResponse(reconciliationRepository.save(item));
    }

    @Transactional
    public ReconciliationCaseResponse resolveReconciliationCase(
            Long caseId, String resolutionNote) {
        PaymentReconciliationCase item = reconciliationRepository.findById(caseId)
                .orElseThrow(() -> new AppException(RECONCILIATION_CASE_NOT_FOUND));
        if (item.getStatus() == ReconciliationStatus.RESOLVED) {
            return reconciliationResponse(item);
        }
        item.setStatus(ReconciliationStatus.RESOLVED);
        item.setResolvedAt(OffsetDateTime.now());
        item.setResolvedBy(adminActor());
        item.setResolutionNote(normalizeNote(resolutionNote));
        item.setNextAttemptAt(null);
        return reconciliationResponse(reconciliationRepository.save(item));
    }

    @Transactional
    public ReconciliationCaseResponse escalateReconciliationCase(
            Long caseId, String resolutionNote) {
        PaymentReconciliationCase item = reconciliationRepository.findById(caseId)
                .orElseThrow(() -> new AppException(RECONCILIATION_CASE_NOT_FOUND));
        if (item.getStatus() == ReconciliationStatus.RESOLVED) {
            throw new AppException(RECONCILIATION_CASE_INVALID_STATE);
        }
        item.setStatus(ReconciliationStatus.MANUAL_REVIEW);
        item.setResolvedBy(adminActor());
        item.setResolutionNote(normalizeNote(resolutionNote));
        item.setNextAttemptAt(null);
        return reconciliationResponse(reconciliationRepository.save(item));
    }

    /**
     * Internal refund boundary used by booking-service after a confirmed booking
     * has passed its cancellation policy. The idempotency key is the source of
     * truth for retry safety; a key may never be reused with another payload.
     *
     * <p>A local/demo override may complete refunds without a provider call.
     * Otherwise the provider-specific gateway signs and submits the request,
     * and the authoritative response is written back to the payment ledger.</p>
     */
    @Transactional
    public PaymentRefundResponse refund(
            String internalServiceKey,
            InternalRefundRequest request) {
        requireInternalCredential(internalServiceKey);
        String normalizedCurrency = request.getCurrency()
                .trim().toUpperCase(Locale.ROOT);
        BigDecimal requestedAmount = money(request.getAmount());
        String requestHash = PaymentHashing.sha256(String.join("|",
                request.getBookingId(),
                request.getPaymentReference(),
                requestedAmount.toPlainString(),
                normalizedCurrency,
                request.getReasonCode(),
                Objects.toString(request.getReason(), "")));

        lockRefundIdempotencyKey(request.getIdempotencyKey());

        PaymentRefund replay = refundRepository
                .findByIdempotencyKey(request.getIdempotencyKey())
                .orElse(null);
        if (replay != null) {
            if (!MessageDigest.isEqual(
                    replay.getRequestHash().getBytes(StandardCharsets.UTF_8),
                    requestHash.getBytes(StandardCharsets.UTF_8))) {
                throw new AppException(IDEMPOTENCY_CONFLICT);
            }
            return refundResponse(replay, true);
        }

        PaymentAttempt attempt = attemptRepository
                .findFirstByBookingIdOrderByCreatedAtDesc(request.getBookingId())
                .orElseThrow(() -> new AppException(PAYMENT_NOT_FOUND));
        if (!Set.of(PaymentStatus.PAID, PaymentStatus.REFUND_PENDING,
                        PaymentStatus.REFUNDED)
                .contains(attempt.getStatus())
                || !paymentReferenceMatches(attempt, request.getPaymentReference())) {
            throw new AppException(REFUND_NOT_ALLOWED);
        }
        if (!attempt.getCurrency().equalsIgnoreCase(normalizedCurrency)
                || requestedAmount.compareTo(attempt.getAmount()) > 0) {
            throw new AppException(REFUND_AMOUNT_MISMATCH);
        }

        PaymentRefund refund = PaymentRefund.builder()
                .payment(attempt)
                .bookingId(attempt.getBookingId())
                .paymentReference(request.getPaymentReference())
                .idempotencyKey(request.getIdempotencyKey())
                .requestHash(requestHash)
                .amount(requestedAmount)
                .currency(normalizedCurrency)
                .reasonCode(request.getReasonCode())
                .reason(request.getReason())
                .status(PaymentRefundStatus.PENDING)
                .build();

        if (paymentProperties.refund().sandboxAutoApprove()) {
            refund.setStatus(PaymentRefundStatus.SUCCEEDED);
            refund.setProviderRefundReference(
                    "SANDBOX-REF-" + UUID.randomUUID());
            refund.setCompletedAt(OffsetDateTime.now());
            attempt.setStatus(PaymentStatus.REFUNDED);
        } else {
            applyProviderRefundResult(
                    attempt,
                    refund,
                    providerRefundGateway.submit(attempt, refund));
        }
        refundRepository.save(refund);
        return refundResponse(refund, false);
    }

    private void applyProviderRefundResult(
            PaymentAttempt attempt,
            PaymentRefund refund,
            ProviderRefundResult result) {
        refund.setProviderRefundReference(result.providerReference());
        switch (result.outcome()) {
            case SUCCEEDED -> {
                refund.setStatus(PaymentRefundStatus.SUCCEEDED);
                refund.setCompletedAt(OffsetDateTime.now());
                attempt.setStatus(PaymentStatus.REFUNDED);
            }
            case PENDING -> {
                refund.setStatus(PaymentRefundStatus.PENDING);
                attempt.setStatus(PaymentStatus.REFUND_PENDING);
            }
            case FAILED -> {
                refund.setStatus(PaymentRefundStatus.FAILED);
                refund.setFailureCode(result.responseCode());
                refund.setFailureMessage(truncate(result.message(), 500));
                refund.setCompletedAt(OffsetDateTime.now());
                attempt.setStatus(PaymentStatus.PAID);
            }
            case UNKNOWN -> {
                refund.setStatus(PaymentRefundStatus.MANUAL_REVIEW);
                refund.setFailureCode(result.responseCode());
                refund.setFailureMessage(truncate(result.message(), 500));
                attempt.setStatus(PaymentStatus.REFUND_PENDING);
                openReconciliation(
                        attempt,
                        "REFUND_PROVIDER_RESULT_UNKNOWN",
                        "Refund " + refund.getIdempotencyKey() + ": " + result.message());
            }
        }
    }

    private void lockRefundIdempotencyKey(String idempotencyKey) {
        jdbcTemplate.execute((ConnectionCallback<Void>) connection -> {
            try (PreparedStatement statement = connection.prepareStatement(
                    "SELECT pg_advisory_xact_lock(hashtextextended(?, 0))")) {
                statement.setString(1, idempotencyKey);
                statement.execute();
            }
            return null;
        });
    }

    public String checkoutRedirect(ProviderCallbackResult result) {
        String bookingId = result.bookingId() == null ? "" : result.bookingId();
        return paymentProperties.frontendCheckoutUrl() + "/" + encodePath(bookingId)
                + "?paymentResult=" + encodePath(
                result.paymentStatus() == null ? "UNKNOWN" : result.paymentStatus());
    }

    private void prepareOutcome(
            PaymentAttempt attempt, String eventType, OffsetDateTime occurredAt) {
        String eventId = PROVIDER + ":" + attempt.getProviderTxnRef() + ":" + eventType;
        PaymentOutcomePayload payload = PaymentOutcomePayload.builder()
                .source(PROVIDER)
                .eventId(eventId)
                .eventType(eventType)
                .bookingId(attempt.getBookingId())
                .paymentReference(attempt.getProviderTransactionId() == null
                        ? attempt.getProviderTxnRef()
                        : attempt.getProviderTransactionId())
                .amount(attempt.getAmount())
                .currency(attempt.getCurrency())
                .occurredAt(occurredAt)
                .build();
        attempt.setOutcomeEventId(eventId);
        attempt.setOutcomeEventType(eventType);
        attempt.setOutcomePayload(outcomePublisher.serialize(payload));
        attempt.setOutcomeDelivered(false);
        attempt.setNextDeliveryAt(OffsetDateTime.now());
    }

    private void deliverOutcome(PaymentAttempt attempt) {
        if (attempt.isOutcomeDelivered() || attempt.getOutcomePayload() == null) {
            return;
        }
        try {
            outcomePublisher.publish(attempt.getOutcomePayload());
            attempt.setOutcomeDelivered(true);
            attempt.setLastDeliveryError(null);
            attempt.setNextDeliveryAt(null);
        } catch (RuntimeException exception) {
            int attempts = attempt.getDeliveryAttempts() + 1;
            attempt.setDeliveryAttempts(attempts);
            attempt.setLastDeliveryError(truncate(exception.getMessage(), 1000));
            attempt.setNextDeliveryAt(OffsetDateTime.now()
                    .plusSeconds(Math.min(300, 1L << Math.min(attempts, 8))));
            if (attempts >= Math.max(paymentProperties.delivery().maxAttempts(), 1)) {
                openReconciliation(attempt,
                        "BOOKING_OUTCOME_DELIVERY_FAILED",
                        "Payment outcome could not be delivered after " + attempts + " attempts.");
            }
            log.warn("Payment outcome delivery failed for {}: {}",
                    attempt.getPaymentId(), exception.getMessage());
        }
    }

    private void openReconciliation(
            PaymentAttempt attempt, String type, String details) {
        reconciliationRepository.save(PaymentReconciliationCase.builder()
                .paymentId(attempt.getPaymentId())
                .bookingId(attempt.getBookingId())
                .caseType(type)
                .severity(attempt.getStatus() == PaymentStatus.PAID ? "CRITICAL" : "HIGH")
                .status(ReconciliationStatus.OPEN)
                .details(details)
                .attemptCount(attempt.getDeliveryAttempts())
                .nextAttemptAt(attempt.getNextDeliveryAt())
                .build());
    }

    private void recordInbox(
            PaymentAttempt attempt,
            Map<String, String> parameters,
            InboxProcessingStatus status,
            String responseCode) {
        String rawPayload = parameters.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> entry.getKey() + "=" + entry.getValue())
                .reduce((left, right) -> left + "&" + right)
                .orElse("");
        String eventKey = callbackEventKey(parameters);
        if (inboxRepository.findByProviderAndEventKey(PROVIDER, eventKey).isPresent()) {
            return;
        }
        inboxRepository.save(PaymentEventInbox.builder()
                .provider(PROVIDER)
                .eventKey(eventKey)
                .paymentId(attempt.getPaymentId())
                .payloadHash(PaymentHashing.sha256(rawPayload))
                .rawPayload(rawPayload)
                .processingStatus(status)
                .responseCode(responseCode)
                .processedAt(OffsetDateTime.now())
                .build());
    }

    private Map<String, String> createVnpayParameters(
            PaymentAttempt attempt, String clientIp, OffsetDateTime now) {
        ZoneId zone = ZoneId.of(vnpayProperties.timezone());
        Map<String, String> params = new HashMap<>();
        params.put("vnp_Version", vnpayProperties.version());
        params.put("vnp_Command", "pay");
        params.put("vnp_TmnCode", vnpayProperties.tmnCode());
        params.put("vnp_Amount", attempt.getAmount()
                .multiply(BigDecimal.valueOf(100))
                .setScale(0, RoundingMode.HALF_UP)
                .toPlainString());
        params.put("vnp_CurrCode", "VND");
        params.put("vnp_TxnRef", attempt.getProviderTxnRef());
        params.put("vnp_OrderInfo", "CinePrime booking " + attempt.getBookingId());
        params.put("vnp_OrderType", "other");
        params.put("vnp_Locale", vnpayProperties.locale());
        params.put("vnp_ReturnUrl", vnpayProperties.returnUrl());
        params.put("vnp_IpAddr", normalizeIp(clientIp));
        params.put("vnp_CreateDate", now.atZoneSameInstant(zone).format(VNPAY_TIME));
        params.put("vnp_ExpireDate",
                attempt.getExpiresAt().atZoneSameInstant(zone).format(VNPAY_TIME));
        return params;
    }

    private void validatePayable(BookingSnapshot booking) {
        if (booking == null
                || booking.getBookingId() == null
                || booking.getTotal() == null
                || booking.getCurrency() == null) {
            throw new AppException(INVALID_REQUEST);
        }
        if (!"PENDING_PAYMENT".equals(booking.getStatus())
                || Set.of("SUCCEEDED", "FAILED", "CANCELLED")
                .contains(booking.getPaymentStatus())) {
            throw new AppException(BOOKING_NOT_PAYABLE);
        }
        if (booking.getExpiresAt() == null
                || !booking.getExpiresAt().isAfter(OffsetDateTime.now())) {
            throw new AppException(BOOKING_EXPIRED);
        }
        if (!"VND".equalsIgnoreCase(booking.getCurrency())) {
            throw new AppException(INVALID_REQUEST);
        }
    }

    private String requestHash(BookingSnapshot booking) {
        return PaymentHashing.sha256(booking.getBookingId()
                + "|" + money(booking.getTotal()).toPlainString()
                + "|" + booking.getCurrency().toUpperCase(Locale.ROOT));
    }

    private PaymentSessionResponse response(PaymentAttempt attempt) {
        return PaymentSessionResponse.builder()
                .paymentId(attempt.getPaymentId())
                .bookingId(attempt.getBookingId())
                .provider(attempt.getProvider())
                .status(attempt.getStatus().name())
                .paymentUrl(attempt.getPaymentUrl())
                .amount(attempt.getAmount())
                .currency(attempt.getCurrency())
                .expiresAt(attempt.getExpiresAt())
                .failureMessage(attempt.getFailureMessage())
                .bankCode(attempt.getBankCode())
                .cardType(attempt.getCardType())
                .build();
    }

    private PaymentRefundResponse refundResponse(
            PaymentRefund refund,
            boolean replayed) {
        return PaymentRefundResponse.builder()
                .refundId(refund.getRefundId())
                .paymentId(refund.getPayment() == null ? null : refund.getPayment().getPaymentId())
                .bookingId(refund.getBookingId())
                .paymentReference(refund.getPaymentReference())
                .providerRefundReference(refund.getProviderRefundReference())
                .status(refund.getStatus().name())
                .amount(refund.getAmount())
                .currency(refund.getCurrency())
                .reasonCode(refund.getReasonCode())
                .reason(refund.getReason())
                .failureCode(refund.getFailureCode())
                .failureMessage(refund.getFailureMessage())
                .createdAt(refund.getCreatedAt())
                .updatedAt(refund.getUpdatedAt())
                .completedAt(refund.getCompletedAt())
                .replayed(replayed)
                .build();
    }

    private ReconciliationCaseResponse reconciliationResponse(
            PaymentReconciliationCase item) {
        return ReconciliationCaseResponse.builder()
                .caseId(item.getCaseId())
                .paymentId(item.getPaymentId())
                .bookingId(item.getBookingId())
                .caseType(item.getCaseType())
                .severity(item.getSeverity())
                .status(item.getStatus().name())
                .details(item.getDetails())
                .attemptCount(item.getAttemptCount())
                .nextAttemptAt(item.getNextAttemptAt())
                .createdAt(item.getCreatedAt())
                .updatedAt(item.getUpdatedAt())
                .resolvedAt(item.getResolvedAt())
                .resolvedBy(item.getResolvedBy())
                .resolutionNote(item.getResolutionNote())
                .build();
    }

    private void resolveOpenCasesForPayment(String paymentId, String note) {
        for (PaymentReconciliationCase item : reconciliationRepository
                .findByPaymentIdAndStatus(paymentId, ReconciliationStatus.OPEN)) {
            item.setStatus(ReconciliationStatus.RESOLVED);
            item.setResolvedAt(OffsetDateTime.now());
            item.setResolvedBy(adminActor());
            item.setResolutionNote(note);
            item.setNextAttemptAt(null);
            reconciliationRepository.save(item);
        }
    }

    private String adminActor() {
        String accountId = JwtSecurityUtils.getCurrentAccountId();
        return accountId == null || accountId.isBlank() ? "ADMIN" : accountId;
    }

    private String normalizeFilter(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String normalizeNote(String note) {
        if (note == null || note.isBlank()) {
            return "Resolved by administrator.";
        }
        return note.trim().length() > 1000 ? note.trim().substring(0, 1000) : note.trim();
    }

    private <E extends Enum<E>> E parseEnum(String raw, Class<E> type) {
        String value = normalizeFilter(raw);
        if (value == null) {
            return null;
        }
        try {
            return Enum.valueOf(type, value.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new AppException(INVALID_REQUEST);
        }
    }

    private boolean paymentReferenceMatches(
            PaymentAttempt attempt,
            String paymentReference) {
        return paymentReference.equals(attempt.getProviderTransactionId())
                || paymentReference.equals(attempt.getProviderTxnRef());
    }

    private void requireInternalCredential(String providedKey) {
        String configuredKey = paymentProperties.internalServiceKey();
        if (providedKey == null
                || configuredKey == null
                || !MessageDigest.isEqual(
                configuredKey.getBytes(StandardCharsets.UTF_8),
                providedKey.getBytes(StandardCharsets.UTF_8))) {
            throw new AppException(INVALID_INTERNAL_CREDENTIAL);
        }
    }

    private boolean isReusable(PaymentAttempt attempt) {
        return (attempt.getStatus() == PaymentStatus.INITIATED
                || attempt.getStatus() == PaymentStatus.PENDING)
                && attempt.getExpiresAt().isAfter(OffsetDateTime.now())
                && attempt.getPaymentUrl() != null;
    }

    private void assertOwner(PaymentAttempt attempt) {
        if (!attempt.getAccountId().equals(requireAccountId())) {
            throw new AppException(PAYMENT_FORBIDDEN);
        }
    }

    private String requireAccountId() {
        String accountId = JwtSecurityUtils.getCurrentAccountId();
        if (accountId == null || accountId.isBlank()) {
            throw new AppException(UNAUTHENTICATED);
        }
        return accountId;
    }

    private void requireText(String value) {
        if (value == null || value.isBlank() || value.length() > 120) {
            throw new AppException(INVALID_REQUEST);
        }
    }

    private String callbackEventKey(Map<String, String> params) {
        return String.join(":",
                Objects.toString(params.get("vnp_TxnRef"), "missing"),
                Objects.toString(params.get("vnp_TransactionNo"), "none"),
                Objects.toString(params.get("vnp_ResponseCode"), "none"));
    }

    private OffsetDateTime parseProviderTime(String value) {
        try {
            return java.time.LocalDateTime.parse(value, VNPAY_TIME)
                    .atZone(ZoneId.of(vnpayProperties.timezone()))
                    .toOffsetDateTime();
        } catch (Exception exception) {
            return OffsetDateTime.now();
        }
    }

    private BigDecimal money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private OffsetDateTime min(OffsetDateTime left, OffsetDateTime right) {
        return left.isBefore(right) ? left : right;
    }

    private String normalizeIp(String clientIp) {
        if (clientIp == null || clientIp.isBlank()) {
            return "127.0.0.1";
        }
        String first = clientIp.split(",")[0].trim();
        return first.equals("0:0:0:0:0:0:0:1") ? "127.0.0.1" : first;
    }

    private String truncate(String value, int maxLength) {
        if (value == null) {
            return "Unknown delivery error";
        }
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }

    private String encodePath(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    public record ProviderCallbackResult(
            String responseCode,
            String message,
            String bookingId,
            String paymentStatus) {
    }
}
