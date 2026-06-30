package movieservice.controller;

import java.util.List;

import org.apache.hc.core5.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;
import movieservice.dto.request.SeatRequest;
import movieservice.dto.response.SeatResponse;
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
                .code(HttpStatus.SC_OK)
                .result(seatService.getSeatsByRoom(roomId))
                .build();
    }

    @GetMapping("/{id}")
    public ApiResponse<SeatResponse> getSeatById(@PathVariable long id) {
        return ApiResponse.<SeatResponse>builder()
                .code(HttpStatus.SC_OK)
                .result(seatService.getSeatById(id))
                .build();
    }

    @PutMapping("/{id}")
    public ApiResponse<SeatResponse> updateSeat(@PathVariable long id,
                                                @Valid @RequestBody SeatRequest request) {
        return ApiResponse.<SeatResponse>builder()
                .code(HttpStatus.SC_OK)
                .result(seatService.updateSeat(id, request))
                .build();
    }
}
