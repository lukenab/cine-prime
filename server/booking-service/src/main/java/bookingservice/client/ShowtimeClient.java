package bookingservice.client;

import java.util.List;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import bookingservice.dto.response.SeatAvailabilityResponse;


@FeignClient(name = "showtime-service", path = "/api/showtimes")
public interface ShowtimeClient {


    @GetMapping("/{showtimeId}/seats")
    List<SeatAvailabilityResponse> getAllSeatsByShowtime(@PathVariable("showtimeId") Long showtimeId);
}
