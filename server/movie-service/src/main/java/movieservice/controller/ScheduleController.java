package movieservice.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import movieservice.dto.request.BulkShowTimeRequest;
import movieservice.dto.request.CreateShowTimeRequest;
import movieservice.dto.request.UpdateShowTimeRequest;
import movieservice.dto.response.BulkShowTimeCreateResponse;
import movieservice.dto.response.BulkShowTimePreviewResponse;
import movieservice.dto.response.ShowTimePricingResponse;
import movieservice.dto.response.ShowTimeResponse;
import movieservice.service.ShowTimeService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/schedules")
@RequiredArgsConstructor
public class ScheduleController {

    private final ShowTimeService showTimeService;

    // ── Read (public) ─────────────────────────────────────────────────────────

    @GetMapping
    public ApiResponse<List<ShowTimeResponse>> getAll() {
        return ApiResponse.<List<ShowTimeResponse>>builder()
                .result(showTimeService.getAll())
                .build();
    }

    @GetMapping("/{id}")
    public ApiResponse<ShowTimeResponse> getById(@PathVariable Long id) {
        return ApiResponse.<ShowTimeResponse>builder()
                .result(showTimeService.getById(id))
                .build();
    }

    /**
     * GET /api/schedules/movie/{movieId}
     * GET /api/schedules/movie/{movieId}?date=2026-07-10
     */
    @GetMapping("/movie/{movieId}")
    public ApiResponse<List<ShowTimeResponse>> getByMovie(
            @PathVariable Long movieId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ApiResponse.<List<ShowTimeResponse>>builder()
                .result(showTimeService.getByMovieId(movieId, date))
                .build();
    }

    // ── Write (ADMIN only) ────────────────────────────────────────────────────

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<ShowTimePricingResponse> createShowTime(
            @Valid @RequestBody CreateShowTimeRequest request) {
        return ApiResponse.<ShowTimePricingResponse>builder()
                .code(1000)
                .message("Showtime created successfully")
                .result(showTimeService.createStandalone(request))
                .build();
    }

    @PostMapping("/generate-preview")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<BulkShowTimePreviewResponse> generatePreview(
            @Valid @RequestBody BulkShowTimeRequest request) {
        return ApiResponse.<BulkShowTimePreviewResponse>builder()
                .code(1000)
                .message("Bulk showtime preview generated successfully")
                .result(showTimeService.generatePreview(request))
                .build();
    }

    @PostMapping("/bulk")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<BulkShowTimeCreateResponse> bulkCreate(
            @Valid @RequestBody BulkShowTimeRequest request) {
        return ApiResponse.<BulkShowTimeCreateResponse>builder()
                .code(1000)
                .message("Bulk showtimes created successfully")
                .result(showTimeService.bulkCreate(request))
                .build();
    }


    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<ShowTimePricingResponse> updateShowTime(
            @PathVariable Long id,
            @Valid @RequestBody UpdateShowTimeRequest request) {
        return ApiResponse.<ShowTimePricingResponse>builder()
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
