package bookingservice.client;

import bookingservice.dto.request.PromotionQuoteRequest;
import bookingservice.dto.request.PromotionReserveRequest;
import bookingservice.dto.response.PromotionQuoteResponse;
import bookingservice.dto.response.PromotionReservationResponse;
import movie.theater.common.dto.ApiResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;

import java.util.UUID;

@FeignClient(name = "promotion-service", path = "/api/internal/promotions")
public interface PromotionClient {
    @PostMapping("/quote")
    ApiResponse<PromotionQuoteResponse> quote(
            @RequestHeader("X-Internal-Service-Key") String internalKey,
            @RequestBody PromotionQuoteRequest request);

    @PostMapping("/reservations")
    ApiResponse<PromotionReservationResponse> reserve(
            @RequestHeader("X-Internal-Service-Key") String internalKey,
            @RequestBody PromotionReserveRequest request);

    @PostMapping("/reservations/{reservationId}/commit")
    ApiResponse<PromotionReservationResponse> commit(
            @RequestHeader("X-Internal-Service-Key") String internalKey,
            @PathVariable UUID reservationId);

    @PostMapping("/reservations/{reservationId}/release")
    ApiResponse<PromotionReservationResponse> release(
            @RequestHeader("X-Internal-Service-Key") String internalKey,
            @PathVariable UUID reservationId);
}
