package movieservice.controller;

import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;
import movieservice.dto.request.CinemaRoomRequest;
import movieservice.dto.request.CinemaRoomUpdateRequest;
import movieservice.dto.request.MaintenanceRequest;
import movieservice.dto.response.CinemaRoomResponse;
import movieservice.dto.response.SeatResponse;
import movieservice.enums.CinemaRoomStatus;
import movieservice.service.CinemaRoomService;
import movieservice.service.SeatService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.http.ResponseEntity;
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
    public ApiResponse<List<CinemaRoomResponse>> getAllRooms(
            @RequestParam(required = false) Long clusterId, Authentication authentication) {
        return ApiResponse.<List<CinemaRoomResponse>>builder()
                .code(200)
                .result(cinemaRoomService.getAllRooms(clusterId, authentication))
                .build();
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE')")
    @PostMapping
    public ApiResponse<CinemaRoomResponse> createRoom(
            @Valid @RequestBody CinemaRoomRequest request, Authentication authentication) {
        return ApiResponse.<CinemaRoomResponse>builder()
                .code(200)
                .result(cinemaRoomService.createCinemaRoom(request, actor(authentication)))
                .build();
    }

    @GetMapping("/{id}")
    public ApiResponse<CinemaRoomResponse> getRoomDetail(@PathVariable Long id, Authentication authentication) {
        return ApiResponse.<CinemaRoomResponse>builder()
                .code(200)
                .result(cinemaRoomService.getRoomDetail(id, authentication))
                .build();
    }

    /** Step 1/2 wizard fields — only while the room is DRAFT (see CinemaRoomService.updateRoom). */
    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE')")
    @PutMapping("/{id}")
    public ApiResponse<CinemaRoomResponse> updateRoom(
            @PathVariable Long id,
            @RequestBody CinemaRoomUpdateRequest request,
            Authentication authentication) {
        return ApiResponse.<CinemaRoomResponse>builder()
                .code(200)
                .result(cinemaRoomService.updateRoom(id, request, actor(authentication)))
                .build();
    }

    /** Hard delete is reserved for an unused DRAFT; operational rooms use retirement instead. */
    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRoom(@PathVariable Long id, Authentication authentication) {
        cinemaRoomService.deleteCinemaRoom(id, authentication);
        return ResponseEntity.noContent().build();
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

    /**
     * Báo sự cố → phòng tự động chuyển TEMPORARILY_UNAVAILABLE.
     * `[Backend] Enforce movie-service endpoint authorization matrix`: actor now comes from
     * the verified JWT (Authentication), never a client-supplied X-User-Name header - a caller
     * could previously set that header to any name (including the "unknown" default) and forge
     * who reported the maintenance.
     */
    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE')")
    @PostMapping("/{id}/maintenance")
    public ApiResponse<Void> reportMaintenance(
            @PathVariable Long id,
            @Valid @RequestBody MaintenanceRequest request,
            Authentication authentication) {
        cinemaRoomService.reportMaintenance(id, request, actor(authentication));
        return ApiResponse.<Void>builder()
                .code(200)
                .message("Maintenance reported. Room set to TEMPORARILY_UNAVAILABLE.")
                .build();
    }

    /** Resolve maintenance → phòng tự động trở về ACTIVE nếu không còn sự cố mở. Actor from
     *  verified JWT, same reasoning as reportMaintenance() above. */
    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE')")
    @PostMapping("/maintenance/{maintenanceId}/resolve")
    public ApiResponse<Void> resolveMaintenance(
            @PathVariable Long maintenanceId,
            @RequestParam(required = false) String resolutionNote,
            Authentication authentication) {
        cinemaRoomService.resolveMaintenance(maintenanceId, resolutionNote, actor(authentication));
        return ApiResponse.<Void>builder()
                .code(200)
                .message("Maintenance resolved.")
                .build();
    }

    /** Đặt thủ công trạng thái phòng (ACTIVE, CLOSED, MAINTENANCE...). Actor from verified JWT,
     *  same reasoning as reportMaintenance() above. */
    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE')")
    @PatchMapping("/{id}/status")
    public ApiResponse<CinemaRoomResponse> setRoomStatus(
            @PathVariable Long id,
            @RequestParam CinemaRoomStatus status,
            Authentication authentication) {
        return ApiResponse.<CinemaRoomResponse>builder()
                .code(200)
                .result(cinemaRoomService.setRoomStatus(id, status, actor(authentication)))
                .build();
    }

    private String actor(Authentication authentication) {
        return authentication != null ? authentication.getName() : "UNKNOWN";
    }
}
