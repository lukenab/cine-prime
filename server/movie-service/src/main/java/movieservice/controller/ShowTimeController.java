package movieservice.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;

import movieservice.dto.response.ShowtimeSeatDto;
import movieservice.service.ShowTimeService;
import java.util.List;

@RestController
@RequestMapping("/api/showtimes")
@RequiredArgsConstructor
public class ShowTimeController {

    private final ShowTimeService showTimeService;

    @GetMapping("/{id}/seats")
    public ApiResponse<List<ShowtimeSeatDto>> getSeats(@PathVariable("id") Long id) {
        return ApiResponse.<List<ShowtimeSeatDto>>builder()
                .code(1000)
                .result(showTimeService.getSeatsByShowtime(id))
                .build();
    }

    @PutMapping("/{id}/seats/lock")
    public ApiResponse<Void> lockSeats(
            @PathVariable("id") Long id,
            @RequestBody List<Long> seatIds) {
        
        showTimeService.lockSeats(id, seatIds);
        
        return ApiResponse.<Void>builder()
                .code(1000)
                .message("Seats locked successfully")
                .build();
    }
}
