package bookingservice.client;

import bookingservice.dto.inventory.InventoryConfirmRequest;
import bookingservice.dto.inventory.InventoryReleaseRequest;
import bookingservice.dto.inventory.InventoryReservationRequest;
import bookingservice.dto.inventory.InventoryReservationResponse;
import movie.theater.common.dto.ApiResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;

@FeignClient(name = "movie-service")
public interface ShowtimeClient {

    @PostMapping("/internal/showtimes/{showtimeId}/inventory-reservations")
    ApiResponse<InventoryReservationResponse> reserve(
            @PathVariable Long showtimeId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody InventoryReservationRequest request);

    @PostMapping("/internal/inventory-confirmations")
    ApiResponse<Object> confirm(
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody InventoryConfirmRequest request);

    @PostMapping("/internal/inventory-releases")
    ApiResponse<Object> release(
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody InventoryReleaseRequest request);
}
