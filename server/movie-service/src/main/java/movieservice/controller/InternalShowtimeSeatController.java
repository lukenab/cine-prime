package movieservice.controller;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import movieservice.config.InternalServiceProperties;
import movieservice.dto.request.ConfirmShowtimeSeatHoldRequest;
import movieservice.dto.request.ReverseShowtimeSeatSaleRequest;
import movieservice.dto.response.ShowtimeSeatHoldMutationResponse;
import movieservice.service.ShowtimeSeatHoldService;

/**
 * Trusted service-to-service inventory boundary used by booking-service after
 * the original customer request has ended.
 */
@RestController
@RequestMapping("/api/internal/showtimes")
@RequiredArgsConstructor
public class InternalShowtimeSeatController {

    private final ShowtimeSeatHoldService holdService;
    private final InternalServiceProperties properties;

    @PostMapping("/{showtimeId}/seat-holds/{holdId}/confirm")
    public ApiResponse<ShowtimeSeatHoldMutationResponse> confirm(
            @PathVariable Long showtimeId,
            @PathVariable String holdId,
            @RequestHeader("X-Internal-Service-Key") String serviceKey,
            @RequestHeader("X-Seat-Hold-Owner") String ownerId,
            @Valid @RequestBody ConfirmShowtimeSeatHoldRequest request) {
        verifyServiceKey(serviceKey);
        return ApiResponse.<ShowtimeSeatHoldMutationResponse>builder()
                .message("Seat sale confirmed")
                .result(holdService.confirm(showtimeId, holdId, request, ownerId))
                .build();
    }

    @DeleteMapping("/{showtimeId}/seat-holds/{holdId}")
    public ApiResponse<ShowtimeSeatHoldMutationResponse> release(
            @PathVariable Long showtimeId,
            @PathVariable String holdId,
            @RequestHeader("X-Internal-Service-Key") String serviceKey,
            @RequestHeader("X-Seat-Hold-Owner") String ownerId) {
        verifyServiceKey(serviceKey);
        return ApiResponse.<ShowtimeSeatHoldMutationResponse>builder()
                .message("Seat hold released")
                .result(holdService.release(showtimeId, holdId, ownerId))
                .build();
    }

    @PostMapping("/{showtimeId}/seat-holds/{holdId}/reverse-sale")
    public ApiResponse<ShowtimeSeatHoldMutationResponse> reverseSale(
            @PathVariable Long showtimeId,
            @PathVariable String holdId,
            @RequestHeader("X-Internal-Service-Key") String serviceKey,
            @RequestHeader("X-Seat-Hold-Owner") String ownerId,
            @Valid @RequestBody ReverseShowtimeSeatSaleRequest request) {
        verifyServiceKey(serviceKey);
        return ApiResponse.<ShowtimeSeatHoldMutationResponse>builder()
                .message("Seat sale reversed")
                .result(holdService.reverseSale(showtimeId, holdId, request, ownerId))
                .build();
    }

    private void verifyServiceKey(String suppliedKey) {
        String expectedKey = properties.getKey();
        if (expectedKey == null || expectedKey.isBlank() || suppliedKey == null
                || !MessageDigest.isEqual(
                        expectedKey.getBytes(StandardCharsets.UTF_8),
                        suppliedKey.getBytes(StandardCharsets.UTF_8))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid internal service credential");
        }
    }
}
