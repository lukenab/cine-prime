package movieservice.controller;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.access.prepost.PreAuthorize;

import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;
import movieservice.dto.request.SeatRequest;
import movieservice.dto.response.SeatResponse;
import movieservice.enums.SeatStatus;
import movieservice.service.SeatService;

@RestController
@RequestMapping("/api/seats")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SeatController {

    SeatService seatService;

    @GetMapping("/room/{roomId}")
    public ApiResponse<List<SeatResponse>> getSeatsByRoom(@PathVariable Long roomId) {
        return ApiResponse.<List<SeatResponse>>builder()
                .code(200)
                .result(seatService.getSeatsByRoom(roomId))
                .build();
    }

    @GetMapping("/{id}")
    public ApiResponse<SeatResponse> getSeatById(@PathVariable long id) {
        return ApiResponse.<SeatResponse>builder()
                .code(200)
                .result(seatService.getSeatById(id))
                .build();
    }

    // `[Backend] Enforce movie-service endpoint authorization matrix`: edits seat structure
    // (type/price), not a booking action - had no @PreAuthorize at all, so any authenticated
    // CUSTOMER could change a seat's type/price. Room/seat configuration is ADMIN/EMPLOYEE only.
    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE')")
    @PutMapping("/{id}")
    public ApiResponse<SeatResponse> updateSeat(@PathVariable long id,
                                                @Valid @RequestBody SeatRequest request) {
        return ApiResponse.<SeatResponse>builder()
                .code(200)
                .result(seatService.updateSeat(id, request))
                .build();
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<SeatResponse> setSeatStatus(@PathVariable long id,
                                                   @RequestParam("status") String statusStr) {
        return ApiResponse.<SeatResponse>builder()
                .code(1000)
                .result(seatService.setSeatStatus(id, statusStr))
                .build();
    }
}
