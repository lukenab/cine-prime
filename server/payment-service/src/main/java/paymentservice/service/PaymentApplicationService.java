package paymentservice.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import movie.theater.common.security.JwtSecurityUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import paymentservice.client.BookingGateway;
import paymentservice.config.PaymentProperties;
import paymentservice.config.VnpayProperties;
import paymentservice.dto.*;
import paymentservice.entity.*;
import paymentservice.provider.VnpaySigner;
import paymentservice.repository.PaymentAttemptRepository;
import paymentservice.repository.PaymentEventInboxRepository;
import paymentservice.repository.PaymentReconciliationCaseRepository;
import paymentservice.repository.PaymentRefundRepository;
import paymentservice.util.PaymentHashing;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
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
    private final BookingGateway bookingGateway;
    private final VnpaySigner vnpaySigner;
    private final VnpayProperties vnpayProperties;
    private final PaymentProperties paymentProperties;
    private final PaymentOutcomePublisher outcomePublisher;

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
        return reconciliationRepository
                .findByStatusOrderByCreatedAtDesc(ReconciliationStatus.OPEN, pageable)
                .map(item -> ReconciliationCaseResponse.builder()
                        .caseId(item.getCaseId())
                        .paymentId(item.getPaymentId())
                        .bookingId(item.getBookingId())
                        .caseType(item.getCaseType())
                        .severity(item.getSeverity())
                        .status(item.getStatus().name())
                        .details(item.getDetails())
                        .attemptCount(item.getAttemptCount())
                        .createdAt(item.getCreatedAt())
                        .build());
    }

    /**
     * Internal refund boundary used by booking-service after a confirmed booking
     * has passed its cancellation policy. The idempotency key is the source of
     * truth for retry safety; a key may never be reused with another payload.
     *
     * <p>The local/demo profile completes refunds synchronously so the full
     * compensation flow can be demonstrated without provider refund
     * credentials. Production keeps the refund in manual review until a
     * provider adapter/webhook completes it.</p>
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
            refund.setStatus(PaymentRefundStatus.MANUAL_REVIEW);
            attempt.setStatus(PaymentStatus.REFUND_PENDING);
            openReconciliation(
                    attempt,
                    "REFUND_PROVIDER_SUBMISSION_REQUIRED",
                    "Refund " + request.getIdempotencyKey()
                            + " requires a configured payment-provider refund adapter.");
        }
        refundRepository.save(refund);
        return refundResponse(refund, false);
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
                .bookingId(refund.getBookingId())
                .providerRefundReference(refund.getProviderRefundReference())
                .status(refund.getStatus().name())
                .amount(refund.getAmount())
                .currency(refund.getCurrency())
                .completedAt(refund.getCompletedAt())
                .replayed(replayed)
                .build();
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
