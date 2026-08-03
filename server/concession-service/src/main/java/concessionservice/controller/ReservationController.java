package concessionservice.controller;

import concessionservice.dto.ConcessionModels.*;
import concessionservice.service.ConcessionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import movie.theater.common.exception.AppException;
import movie.theater.common.security.JwtSecurityUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import static concessionservice.exception.ConcessionErrorCode.INTERNAL_UNAUTHORIZED;
import static concessionservice.exception.ConcessionErrorCode.INVALID_REQUEST;

@RestController
@RequiredArgsConstructor
public class ReservationController {
    private final ConcessionService service;

    @Value("${concession.internal-key}")
    private String internalKey;

    @PostMapping("/api/concession-reservations")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ReservationResponse> reserve(@Valid @RequestBody ReservationRequest request) {
        String accountId = JwtSecurityUtils.getCurrentAccountId();
        if (accountId == null || !accountId.equals(request.customerId())) {
            throw new AppException(INVALID_REQUEST);
        }
        return result(service.reserve(request));
    }

    @GetMapping("/api/concession-reservations/{id}")
    public ApiResponse<ReservationResponse> get(@PathVariable String id) {
        service.requireReservationOwner(id, requireAccountId());
        return result(service.reservation(id, false));
    }

    @DeleteMapping("/api/concession-reservations/{id}")
    public ApiResponse<ReservationResponse> release(@PathVariable String id) {
        service.requireReservationOwner(id, requireAccountId());
        return result(service.release(id, false));
    }

    @PostMapping("/api/internal/concession-reservations")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ReservationResponse> reserveInternal(
            @RequestHeader("X-Internal-Service-Key") String key,
            @Valid @RequestBody ReservationRequest request) {
        requireInternal(key);
        return result(service.reserve(request));
    }

    @GetMapping("/api/internal/concession-reservations/{id}")
    public ApiResponse<ReservationResponse> getInternal(
            @RequestHeader("X-Internal-Service-Key") String key,
            @PathVariable String id) {
        requireInternal(key);
        return result(service.reservation(id, false));
    }

    @PostMapping("/api/internal/concession-reservations/{id}/confirm")
    public ApiResponse<OrderResponse> confirm(
            @RequestHeader("X-Internal-Service-Key") String key,
            @PathVariable String id,
            @RequestBody(required = false) ConfirmRequest request) {
        requireInternal(key);
        return result(service.confirm(id, request));
    }

    @PostMapping("/api/internal/concession-reservations/{id}/release")
    public ApiResponse<ReservationResponse> releaseInternal(
            @RequestHeader("X-Internal-Service-Key") String key,
            @PathVariable String id) {
        requireInternal(key);
        return result(service.release(id, false));
    }

    private void requireInternal(String key) {
        if (key == null || !java.security.MessageDigest.isEqual(
                key.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                internalKey.getBytes(java.nio.charset.StandardCharsets.UTF_8))) {
            throw new AppException(INTERNAL_UNAUTHORIZED);
        }
    }

    private String requireAccountId() {
        String accountId = JwtSecurityUtils.getCurrentAccountId();
        if (accountId == null || accountId.isBlank()) {
            throw new AppException(INVALID_REQUEST);
        }
        return accountId;
    }

    private <T> ApiResponse<T> result(T value) {
        return ApiResponse.<T>builder().result(value).build();
    }
}
