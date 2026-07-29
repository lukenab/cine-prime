package bookingservice.client;

import bookingservice.dto.request.InternalPaymentRefundRequest;
import bookingservice.dto.response.PaymentRefundResponse;
import movie.theater.common.dto.ApiResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;

@FeignClient(name = "payment-refund-client", url = "${payment-service.url}")
public interface PaymentClient {

    @PostMapping("/api/payments/internal/refunds")
    ApiResponse<PaymentRefundResponse> requestRefund(
            @RequestHeader("X-Internal-Service-Key") String internalKey,
            @RequestBody InternalPaymentRefundRequest request);
}
