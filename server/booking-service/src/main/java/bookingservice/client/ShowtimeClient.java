package bookingservice.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;

import bookingservice.dto.request.MovieSeatHoldRequest;
import bookingservice.dto.response.MovieSeatHoldResponse;
import movie.theater.common.dto.ApiResponse;


@FeignClient(name = "movie-service", path = "/api/showtimes")
public interface ShowtimeClient {

    @PostMapping("/{showtimeId}/seat-holds")
    ApiResponse<MovieSeatHoldResponse> holdSeats(
            @PathVariable("showtimeId") Long showtimeId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody MovieSeatHoldRequest request);
}
