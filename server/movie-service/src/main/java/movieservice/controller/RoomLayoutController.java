package movieservice.controller;

import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;
import movie.theater.common.exception.AppException;
import movieservice.dto.request.RejectRequest;
import movieservice.dto.request.RoomLayoutSaveRequest;
import movieservice.dto.response.RoomLayoutResponse;
import movieservice.dto.response.RoomLayoutSummaryResponse;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.CinemaRoomRepository;
import movieservice.service.RoomLayoutService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cinema-rooms/{roomId}/layouts")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class RoomLayoutController {

    RoomLayoutService roomLayoutService;
    CinemaRoomRepository cinemaRoomRepository;

    @GetMapping
    public ApiResponse<List<RoomLayoutSummaryResponse>> list(@PathVariable Long roomId) {
        requireRoomExists(roomId);
        return ApiResponse.<List<RoomLayoutSummaryResponse>>builder()
                .code(200)
                .result(roomLayoutService.listLayouts(roomId))
                .build();
    }

    @GetMapping("/{layoutId}")
    public ApiResponse<RoomLayoutResponse> get(@PathVariable Long roomId, @PathVariable Long layoutId) {
        return ApiResponse.<RoomLayoutResponse>builder()
                .code(200)
                .result(roomLayoutService.getLayout(roomId, layoutId))
                .build();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{layoutId}")
    public ApiResponse<RoomLayoutResponse> save(
            @PathVariable Long roomId,
            @PathVariable Long layoutId,
            @Valid @RequestBody RoomLayoutSaveRequest request,
            Authentication authentication) {
        return ApiResponse.<RoomLayoutResponse>builder()
                .code(200)
                .result(roomLayoutService.saveLayout(roomId, layoutId, request, actor(authentication)))
                .build();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/{layoutId}/submit")
    public ApiResponse<RoomLayoutResponse> submit(
            @PathVariable Long roomId, @PathVariable Long layoutId, Authentication authentication) {
        return ApiResponse.<RoomLayoutResponse>builder()
                .code(200)
                .result(roomLayoutService.submit(roomId, layoutId, actor(authentication)))
                .build();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/{layoutId}/approve")
    public ApiResponse<RoomLayoutResponse> approve(
            @PathVariable Long roomId, @PathVariable Long layoutId, Authentication authentication) {
        return ApiResponse.<RoomLayoutResponse>builder()
                .code(200)
                .result(roomLayoutService.approve(roomId, layoutId, actor(authentication)))
                .build();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/{layoutId}/reject")
    public ApiResponse<RoomLayoutResponse> reject(
            @PathVariable Long roomId, @PathVariable Long layoutId,
            @Valid @RequestBody RejectRequest request, Authentication authentication) {
        return ApiResponse.<RoomLayoutResponse>builder()
                .code(200)
                .result(roomLayoutService.reject(roomId, layoutId, request.getNote(), actor(authentication)))
                .build();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/{layoutId}/activate")
    public ApiResponse<RoomLayoutResponse> activate(
            @PathVariable Long roomId, @PathVariable Long layoutId, Authentication authentication) {
        return ApiResponse.<RoomLayoutResponse>builder()
                .code(200)
                .result(roomLayoutService.activate(roomId, layoutId, actor(authentication)))
                .build();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/{layoutId}/clone")
    public ApiResponse<RoomLayoutResponse> clone(
            @PathVariable Long roomId, @PathVariable Long layoutId, Authentication authentication) {
        return ApiResponse.<RoomLayoutResponse>builder()
                .code(201)
                .result(roomLayoutService.clone(roomId, layoutId, actor(authentication)))
                .build();
    }

    private void requireRoomExists(Long roomId) {
        if (!cinemaRoomRepository.existsById(roomId)) {
            throw new AppException(MovieErrorCode.CINEMA_ROOM_NOT_FOUND);
        }
    }

    private String actor(Authentication authentication) {
        return authentication != null ? authentication.getName() : "UNKNOWN";
    }
}
