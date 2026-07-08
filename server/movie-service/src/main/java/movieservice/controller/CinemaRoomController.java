package movieservice.controller;

import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;
import movieservice.dto.request.CinemaRoomRequest;
import movieservice.dto.request.MaintenanceRequest;
import movieservice.dto.response.CinemaRoomResponse;
import movieservice.dto.response.SeatResponse;
import movieservice.enums.CinemaRoomStatus;
import movieservice.service.CinemaRoomService;
import movieservice.service.SeatService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cinema-rooms")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class CinemaRoomController {

    CinemaRoomService cinemaRoomService;
    SeatService seatService;

    @GetMapping
    public ApiResponse<List<CinemaRoomResponse>> getAllRooms() {
        return ApiResponse.<List<CinemaRoomResponse>>builder()
                .code(200)
                .result(cinemaRoomService.getAllRooms())
                .build();
    }

    @PostMapping
    public ApiResponse<CinemaRoomResponse> createRoom(@Valid @RequestBody CinemaRoomRequest request) {
        return ApiResponse.<CinemaRoomResponse>builder()
                .code(200)
                .result(cinemaRoomService.createCinemaRoom(request))
                .build();
    }

    // ── Seats ─────────────────────────────────────────────────

    @GetMapping("/{id}/seats")
    public ApiResponse<List<SeatResponse>> getSeatsByRoom(@PathVariable Long id) {
        return ApiResponse.<List<SeatResponse>>builder()
                .code(200)
                .result(seatService.getSeatsByRoom(id))
                .build();
    }

    // ── Maintenance ───────────────────────────────────────────

    /** Báo sự cố → phòng tự động chuyển TEMPORARILY_UNAVAILABLE */
    @PostMapping("/{id}/maintenance")
    public ApiResponse<Void> reportMaintenance(
            @PathVariable Long id,
            @Valid @RequestBody MaintenanceRequest request,
            @RequestHeader(value = "X-User-Name", defaultValue = "unknown") String createdBy) {
        cinemaRoomService.reportMaintenance(id, request, createdBy);
        return ApiResponse.<Void>builder()
                .code(200)
                .message("Maintenance reported. Room set to TEMPORARILY_UNAVAILABLE.")
                .build();
    }

    /** Resolve maintenance → phòng tự động trở về ACTIVE nếu không còn sự cố mở */
    @PostMapping("/maintenance/{maintenanceId}/resolve")
    public ApiResponse<Void> resolveMaintenance(
            @PathVariable Long maintenanceId,
            @RequestParam(required = false) String resolutionNote,
            @RequestHeader(value = "X-User-Name", defaultValue = "unknown") String resolvedBy) {
        cinemaRoomService.resolveMaintenance(maintenanceId, resolutionNote, resolvedBy);
        return ApiResponse.<Void>builder()
                .code(200)
                .message("Maintenance resolved.")
                .build();
    }

    /** Đặt thủ công trạng thái phòng (ACTIVE, CLOSED, MAINTENANCE...) */
    @PatchMapping("/{id}/status")
    public ApiResponse<CinemaRoomResponse> setStatus(
            @PathVariable Long id,
            @RequestParam CinemaRoomStatus status,
            @RequestHeader(value = "X-User-Name", defaultValue = "unknown") String updatedBy) {
        return ApiResponse.<CinemaRoomResponse>builder()
                .code(200)
                .result(cinemaRoomService.setRoomStatus(id, status, updatedBy))
                .build();
    }
}
