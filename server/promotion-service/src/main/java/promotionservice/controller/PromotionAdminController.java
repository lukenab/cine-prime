package promotionservice.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import promotionservice.dto.request.PromotionUpsertRequest;
import promotionservice.dto.response.PromotionResponse;
import promotionservice.dto.response.PromotionPageResponse;
import promotionservice.enums.PromotionStatus;
import promotionservice.service.PromotionAdminService;

import java.util.UUID;

@RestController
@RequestMapping("/api/promotions")
@RequiredArgsConstructor
@PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'PROMOTION_CREATE', 'PROMOTION_UPDATE')")
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
    public ApiResponse<PromotionPageResponse> search(
            @RequestParam(required = false) PromotionStatus status,
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.max(1, Math.min(size, 100));
        PageRequest pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "updatedAt"));
        return ApiResponse.<PromotionPageResponse>builder()
                .code(200)
                .result(service.search(status, query, pageable))
                .build();
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
