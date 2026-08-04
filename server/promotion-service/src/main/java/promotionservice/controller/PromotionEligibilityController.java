package promotionservice.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import movie.theater.common.exception.AppException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import promotionservice.dto.request.PromotionQuoteRequest;
import promotionservice.dto.request.PromotionReserveRequest;
import promotionservice.dto.response.PromotionQuoteResponse;
import promotionservice.dto.response.PromotionReservationResponse;
import promotionservice.service.PromotionEligibilityService;

import java.util.UUID;

@RestController
@RequestMapping("/api/internal/promotions")
@RequiredArgsConstructor
public class PromotionEligibilityController {
    private final PromotionEligibilityService service;

    @Value("${promotion.internal-key}")
    private String internalKey;

    @PostMapping("/quote")
    public ApiResponse<PromotionQuoteResponse> quote(
            @RequestHeader("X-Internal-Service-Key") String key,
            @Valid @RequestBody PromotionQuoteRequest request) {
        requireInternal(key);
        return ApiResponse.<PromotionQuoteResponse>builder().code(200).result(service.quote(request)).build();
    }

    @PostMapping("/reservations")
    public ApiResponse<PromotionReservationResponse> reserve(
            @RequestHeader("X-Internal-Service-Key") String key,
            @Valid @RequestBody PromotionReserveRequest request) {
        requireInternal(key);
        return ApiResponse.<PromotionReservationResponse>builder().code(201).result(service.reserve(request)).build();
    }

    @PostMapping("/reservations/{id}/commit")
    public ApiResponse<PromotionReservationResponse> commit(
            @RequestHeader("X-Internal-Service-Key") String key,
            @PathVariable UUID id) {
        requireInternal(key);
        return ApiResponse.<PromotionReservationResponse>builder().code(200).result(service.commit(id)).build();
    }

    @PostMapping("/reservations/{id}/release")
    public ApiResponse<PromotionReservationResponse> release(
            @RequestHeader("X-Internal-Service-Key") String key,
            @PathVariable UUID id) {
        requireInternal(key);
        return ApiResponse.<PromotionReservationResponse>builder().code(200).result(service.release(id)).build();
    }

    private void requireInternal(String key) {
        if (key == null || !java.security.MessageDigest.isEqual(
                key.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                internalKey.getBytes(java.nio.charset.StandardCharsets.UTF_8))) {
            throw new AppException(promotionservice.exception.PromotionErrorCode.INTERNAL_UNAUTHORIZED);
        }
    }
}
