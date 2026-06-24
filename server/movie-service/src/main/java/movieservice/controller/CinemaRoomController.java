package movieservice.controller;

import java.util.List;

import org.apache.hc.core5.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movieservice.dto.request.CinemaRoomRequest;
import movieservice.dto.response.CinemaRoomResponse;
import movieservice.service.CinemaRoomService;
import movie.theater.common.dto.ApiResponse;

@RestController
@RequestMapping("/api/cinema-rooms")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class CinemaRoomController {
    CinemaRoomService cinemaRoomService;
    @GetMapping
    public ApiResponse<List<CinemaRoomResponse>> getAllRooms() {
        return ApiResponse.<List<CinemaRoomResponse>>builder()
                .code(HttpStatus.SC_OK)
                .result(cinemaRoomService.getAllRooms())
                .build();
    }

    @PostMapping
    public ApiResponse<CinemaRoomResponse> createTypeRoom(@Valid @RequestBody CinemaRoomRequest cinemaRoomRequest) {
        return ApiResponse.<CinemaRoomResponse>builder()
                .code(HttpStatus.SC_OK)
                .result(cinemaRoomService.createCinemaRoom(cinemaRoomRequest))
                .build();
    }
}
