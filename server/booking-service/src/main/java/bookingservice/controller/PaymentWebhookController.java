package bookingservice.controller;

import bookingservice.dto.response.PaymentOutcomeResponse;
import bookingservice.service.PaymentWebhookService;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/internal/payments/webhooks")
@RequiredArgsConstructor
public class PaymentWebhookController {
    private final PaymentWebhookService paymentWebhookService;

    @PostMapping("/outcome")
    public ApiResponse<PaymentOutcomeResponse> outcome(
            @RequestHeader("X-Webhook-Signature") String signature,
            @RequestBody String rawPayload) {
        return ApiResponse.<PaymentOutcomeResponse>builder()
                .message("Payment outcome processed.")
                .result(paymentWebhookService.process(rawPayload, signature))
                .build();
    }
}
