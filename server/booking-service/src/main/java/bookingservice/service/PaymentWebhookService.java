package bookingservice.service;

import bookingservice.client.MovieInventoryClient;
import bookingservice.dto.request.ConfirmMovieSeatHoldRequest;
import bookingservice.dto.request.PaymentOutcomeRequest;
import bookingservice.dto.response.PaymentOutcomeResponse;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.UUID;

import static bookingservice.exception.BookingErrorCode.*;

@Service
@RequiredArgsConstructor
public class PaymentWebhookService {
    private final ObjectMapper objectMapper;
    private final MovieInventoryClient movieInventoryClient;
    private final PaymentProcessingStateService stateService;

    @Value("${booking.payment.webhook-secret}")
    private String webhookSecret;

    @Value("${movie-service.internal-key}")
    private String movieServiceInternalKey;

    public PaymentOutcomeResponse process(String rawPayload, String signature) {
        if (!validSignature(rawPayload, signature)) {
            throw new AppException(PAYMENT_EVENT_INVALID);
        }
        PaymentOutcomeRequest request = parseAndValidate(rawPayload);
        String correlationId = UUID.randomUUID().toString();
        PaymentProcessingStateService.PaymentInstruction instruction =
                stateService.prepare(request, rawPayload, correlationId);

        return switch (instruction.action()) {
            case REJECT_AMOUNT -> throw new AppException(PAYMENT_AMOUNT_MISMATCH);
            case REJECT_EVENT -> throw new AppException(PAYMENT_EVENT_INVALID);
            case CONFIRM_INVENTORY -> confirmInventory(instruction);
            case RELEASE_INVENTORY -> releaseInventory(instruction);
            case NONE, LATE_PAYMENT -> stateService.currentResponse(instruction);
        };
    }

    private PaymentOutcomeResponse confirmInventory(
            PaymentProcessingStateService.PaymentInstruction instruction) {
        try {
            movieInventoryClient.confirmHold(
                    instruction.showtimeId(),
                    instruction.holdId(),
                    movieServiceInternalKey,
                    instruction.ownerId(),
                    new ConfirmMovieSeatHoldRequest(instruction.bookingId()));
            return stateService.completeInventoryConfirmation(instruction);
        } catch (RuntimeException exception) {
            stateService.markDependencyFailure(instruction, exception);
            throw new AppException(INVENTORY_CONFIRMATION_FAILED);
        }
    }

    private PaymentOutcomeResponse releaseInventory(
            PaymentProcessingStateService.PaymentInstruction instruction) {
        try {
            movieInventoryClient.releaseHold(
                    instruction.showtimeId(),
                    instruction.holdId(),
                    movieServiceInternalKey,
                    instruction.ownerId());
            return stateService.completeInventoryRelease(instruction);
        } catch (RuntimeException exception) {
            return stateService.markDependencyFailure(instruction, exception);
        }
    }

    private PaymentOutcomeRequest parseAndValidate(String rawPayload) {
        try {
            PaymentOutcomeRequest request =
                    objectMapper.readValue(rawPayload, PaymentOutcomeRequest.class);
            if (isBlank(request.getSource())
                    || isBlank(request.getEventId())
                    || isBlank(request.getEventType())
                    || isBlank(request.getBookingId())
                    || isBlank(request.getPaymentReference())
                    || request.getAmount() == null
                    || request.getAmount().signum() < 0
                    || isBlank(request.getCurrency())) {
                throw new AppException(PAYMENT_EVENT_INVALID);
            }
            return request;
        } catch (JsonProcessingException exception) {
            throw new AppException(PAYMENT_EVENT_INVALID);
        }
    }

    private boolean validSignature(String payload, String signature) {
        if (isBlank(payload) || isBlank(signature) || isBlank(webhookSecret)) {
            return false;
        }
        try {
            Mac hmac = Mac.getInstance("HmacSHA256");
            hmac.init(new SecretKeySpec(
                    webhookSecret.getBytes(StandardCharsets.UTF_8),
                    "HmacSHA256"));
            byte[] expected = hmac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            String normalized = signature.startsWith("sha256=")
                    ? signature.substring("sha256=".length())
                    : signature;
            byte[] actual = HexFormat.of().parseHex(normalized);
            return MessageDigest.isEqual(expected, actual);
        } catch (Exception exception) {
            return false;
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
