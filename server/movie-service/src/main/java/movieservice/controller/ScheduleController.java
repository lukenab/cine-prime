package movieservice.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import movieservice.dto.request.CreateShowTimeRequest;
import movieservice.dto.request.UpdateShowTimeRequest;
import movieservice.dto.response.ShowTimeResponse;
import movieservice.service.ShowTimeService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/schedules")
@RequiredArgsConstructor
public class ScheduleController {

    private final ShowTimeService showTimeService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<ShowTimeResponse> createShowTime(
            @Valid @RequestBody CreateShowTimeRequest request) {
        return ApiResponse.<ShowTimeResponse>builder()
                .code(1000)
                .message("Showtime created successfully")
                .result(showTimeService.createStandalone(request))
                .build();
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<ShowTimeResponse> updateShowTime(
            @PathVariable Long id,
            @RequestBody UpdateShowTimeRequest request) {
        return ApiResponse.<ShowTimeResponse>builder()
                .code(1000)
                .message("Showtime updated successfully")
                .result(showTimeService.update(id, request))
                .build();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> deleteShowTime(@PathVariable Long id) {
        showTimeService.deleteById(id);
        return ApiResponse.<Void>builder()
                .code(1000)
                .message("Showtime deleted successfully")
                .build();
    }
}
