package movieservice.controller;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import movie.theater.common.security.JwtSecurityUtils;

import movieservice.dto.request.HoldShowtimeSeatsRequest;
import movieservice.dto.response.ShowtimeSeatHoldResponse;
import movieservice.dto.response.ShowtimeSeatDto;
import movieservice.dto.response.ShowtimeSeatMapResponse;
import movieservice.service.ShowTimeService;
import movieservice.service.ShowtimeSeatHoldService;
import jakarta.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/showtimes")
@RequiredArgsConstructor
public class ShowTimeController {

    private final ShowTimeService showTimeService;
    private final ShowtimeSeatHoldService showtimeSeatHoldService;

    @GetMapping("/{id}/seats")
    public ApiResponse<List<ShowtimeSeatDto>> getSeats(@PathVariable("id") Long id) {
        return ApiResponse.<List<ShowtimeSeatDto>>builder()
                .code(1000)
                .result(showTimeService.getSeatsByShowtime(id))
                .build();
    }

    /** Customer-facing physical room snapshot with live inventory state. */
    @GetMapping("/{id}/seat-map")
    public ApiResponse<ShowtimeSeatMapResponse> getSeatMap(@PathVariable("id") Long id) {
        return ApiResponse.<ShowtimeSeatMapResponse>builder()
                .code(1000)
                .result(showTimeService.getSeatMapByShowtime(id))
                .build();
    }

    /**
     * Creates one all-or-nothing temporary hold. The idempotency key must remain
     * stable while the client retries the same selection.
     */
    @PostMapping("/{id}/seat-holds")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ShowtimeSeatHoldResponse> holdSeats(
            @PathVariable("id") Long id,
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody HoldShowtimeSeatsRequest request) {
        ShowtimeSeatHoldResponse hold = showtimeSeatHoldService.hold(
                id,
                request,
                JwtSecurityUtils.getCurrentAccountId(),
                idempotencyKey);

        return ApiResponse.<ShowtimeSeatHoldResponse>builder()
                .code(1000)
                .message(hold.isReplayed() ? "Seat hold replayed" : "Seats held successfully")
                .result(hold)
                .build();
    }
}
