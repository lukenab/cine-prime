package promotionservice.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import promotionservice.dto.request.PromotionUpsertRequest;
import promotionservice.dto.response.PromotionResponse;
import promotionservice.enums.PromotionStatus;
import promotionservice.service.PromotionAdminService;

import java.util.UUID;

@RestController
@RequestMapping("/api/promotions")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class PromotionAdminController {
    private final PromotionAdminService service;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<PromotionResponse> create(@Valid @RequestBody PromotionUpsertRequest request) {
        return ApiResponse.<PromotionResponse>builder().code(201).result(service.create(request)).build();
    }

    @GetMapping("/{id}")
    public ApiResponse<PromotionResponse> detail(@PathVariable UUID id) {
        return ApiResponse.<PromotionResponse>builder().code(200).result(service.get(id)).build();
    }

    @GetMapping
    public ApiResponse<Page<PromotionResponse>> search(@RequestParam(required = false) PromotionStatus status, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.<Page<PromotionResponse>>builder().code(200).result(service.search(status, PageRequest.of(page, Math.min(size, 100)))).build();
    }

    @PutMapping("/{id}")
    public ApiResponse<PromotionResponse> updateDraft(@PathVariable UUID id, @Valid @RequestBody PromotionUpsertRequest request) {
        return ApiResponse.<PromotionResponse>builder().code(200).result(service.updateDraft(id, request)).build();
    }

    @PostMapping("/{id}/activate")
    public ApiResponse<PromotionResponse> activate(@PathVariable UUID id) {
        return ApiResponse.<PromotionResponse>builder().code(200).result(service.activate(id)).build();
    }

    @PostMapping("/{id}/pause")
    public ApiResponse<PromotionResponse> pause(@PathVariable UUID id) {
        return ApiResponse.<PromotionResponse>builder().code(200).result(service.pause(id)).build();
    }

    @PostMapping("/{id}/retire")
    public ApiResponse<PromotionResponse> retire(@PathVariable UUID id) {
        return ApiResponse.<PromotionResponse>builder().code(200).result(service.retire(id)).build();
    }
}
