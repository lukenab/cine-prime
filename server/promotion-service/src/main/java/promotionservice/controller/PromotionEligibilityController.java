package promotionservice.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import org.springframework.web.bind.annotation.*;
import promotionservice.dto.request.PromotionQuoteRequest;
import promotionservice.dto.request.PromotionReserveRequest;
import promotionservice.dto.response.PromotionQuoteResponse;
import promotionservice.dto.response.PromotionReservationResponse;
import promotionservice.service.PromotionEligibilityService;

import java.util.UUID;

@RestController
@RequestMapping("/api/promotions")
@RequiredArgsConstructor
public class PromotionEligibilityController {
    private final PromotionEligibilityService service;

    @PostMapping("/quote")
    public ApiResponse<PromotionQuoteResponse> quote(@Valid @RequestBody PromotionQuoteRequest request) {
        return ApiResponse.<PromotionQuoteResponse>builder().code(200).result(service.quote(request)).build();
    }

    @PostMapping("/reservations")
    public ApiResponse<PromotionReservationResponse> reserve(@Valid @RequestBody PromotionReserveRequest request) {
        return ApiResponse.<PromotionReservationResponse>builder().code(201).result(service.reserve(request)).build();
    }

    @PostMapping("/reservations/{id}/commit")
    public ApiResponse<PromotionReservationResponse> commit(@PathVariable UUID id) {
        return ApiResponse.<PromotionReservationResponse>builder().code(200).result(service.commit(id)).build();
    }

    @PostMapping("/reservations/{id}/release")
    public ApiResponse<PromotionReservationResponse> release(@PathVariable UUID id) {
        return ApiResponse.<PromotionReservationResponse>builder().code(200).result(service.release(id)).build();
    }
}
