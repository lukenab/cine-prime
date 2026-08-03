package bookingservice.client;

import bookingservice.dto.request.ConcessionReservationRequest;
import bookingservice.dto.request.ConfirmConcessionReservationRequest;
import bookingservice.dto.response.ConcessionOrderResponse;
import bookingservice.dto.response.ConcessionReservationResponse;
import movie.theater.common.dto.ApiResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;

@FeignClient(name = "concession-client", url = "${concession-service.url}")
public interface ConcessionClient {
    @PostMapping("/api/internal/concession-reservations")
    ApiResponse<ConcessionReservationResponse> reserve(
            @RequestHeader("X-Internal-Service-Key") String internalKey,
            @RequestBody ConcessionReservationRequest request);

    @PostMapping("/api/internal/concession-reservations/{id}/confirm")
    ApiResponse<ConcessionOrderResponse> confirm(
            @PathVariable String id,
            @RequestHeader("X-Internal-Service-Key") String internalKey,
            @RequestBody ConfirmConcessionReservationRequest request);

    @PostMapping("/api/internal/concession-reservations/{id}/release")
    ApiResponse<ConcessionReservationResponse> release(
            @PathVariable String id,
            @RequestHeader("X-Internal-Service-Key") String internalKey);
}
