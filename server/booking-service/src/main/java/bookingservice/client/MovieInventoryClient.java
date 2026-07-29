package bookingservice.client;

import bookingservice.dto.request.ConfirmMovieSeatHoldRequest;
import bookingservice.dto.request.MovieSeatHoldRequest;
import bookingservice.dto.request.ReverseMovieSeatSaleRequest;
import bookingservice.dto.response.MovieSeatHoldResponse;
import bookingservice.dto.response.MovieShowtimeResponse;
import movie.theater.common.dto.ApiResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;

@FeignClient(name = "movie-inventory-client", url = "${movie-service.url}")
public interface MovieInventoryClient {

    @GetMapping("/api/schedules/{showtimeId}")
    ApiResponse<MovieShowtimeResponse> getPublicShowtime(@PathVariable Long showtimeId);

    @PostMapping("/api/showtimes/{showtimeId}/seat-holds")
    ApiResponse<MovieSeatHoldResponse> holdSeats(
            @PathVariable Long showtimeId,
            @RequestHeader("Authorization") String authorization,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestHeader("X-Booking-Channel") String channel,
            @RequestBody MovieSeatHoldRequest request);

    @PostMapping("/api/internal/showtimes/{showtimeId}/seat-holds/{holdId}/confirm")
    ApiResponse<Void> confirmHold(
            @PathVariable Long showtimeId,
            @PathVariable String holdId,
            @RequestHeader("X-Internal-Service-Key") String internalKey,
            @RequestHeader("X-Seat-Hold-Owner") String ownerId,
            @RequestBody ConfirmMovieSeatHoldRequest request);

    @DeleteMapping("/api/internal/showtimes/{showtimeId}/seat-holds/{holdId}")
    ApiResponse<Void> releaseHold(
            @PathVariable Long showtimeId,
            @PathVariable String holdId,
            @RequestHeader("X-Internal-Service-Key") String internalKey,
            @RequestHeader("X-Seat-Hold-Owner") String ownerId);

    @PostMapping("/api/internal/showtimes/{showtimeId}/seat-holds/{holdId}/reverse-sale")
    ApiResponse<Void> reverseSale(
            @PathVariable Long showtimeId,
            @PathVariable String holdId,
            @RequestHeader("X-Internal-Service-Key") String internalKey,
            @RequestHeader("X-Seat-Hold-Owner") String ownerId,
            @RequestBody ReverseMovieSeatSaleRequest request);
}
