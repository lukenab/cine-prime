package bookingservice.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;

import bookingservice.dto.request.MovieSeatHoldRequest;
import bookingservice.dto.response.MovieSeatHoldResponse;
import bookingservice.dto.response.MovieSeatMapResponse;
import movie.theater.common.dto.ApiResponse;


@FeignClient(name = "movie-service", path = "/api/showtimes")
public interface ShowtimeClient {

    @GetMapping("/{showtimeId}/seat-map")
    ApiResponse<MovieSeatMapResponse> getSeatMap(@PathVariable("showtimeId") Long showtimeId);

    @PostMapping("/{showtimeId}/seat-holds")
    ApiResponse<MovieSeatHoldResponse> holdSeats(
            @PathVariable("showtimeId") Long showtimeId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody MovieSeatHoldRequest request);
}
