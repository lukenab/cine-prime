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
import promotionservice.dto.request.PromotionNoteRequest;
import promotionservice.dto.request.PromotionReasonRequest;
import promotionservice.dto.response.PromotionResponse;
import promotionservice.dto.response.PromotionPageResponse;
import promotionservice.enums.PromotionStatus;
import promotionservice.service.PromotionAdminService;

import java.util.UUID;

@RestController
@RequestMapping("/api/promotions")
@RequiredArgsConstructor
public class PromotionAdminController {
    private final PromotionAdminService service;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'PROMOTION_CREATE')")
    public ApiResponse<PromotionResponse> create(@Valid @RequestBody PromotionUpsertRequest request) {
        return ApiResponse.<PromotionResponse>builder().code(201).result(service.create(request)).build();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'PROMOTION_READ')")
    public ApiResponse<PromotionResponse> detail(@PathVariable UUID id) {
        return ApiResponse.<PromotionResponse>builder().code(200).result(service.get(id)).build();
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'PROMOTION_READ')")
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
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'PROMOTION_UPDATE')")
    public ApiResponse<PromotionResponse> updateDraft(@PathVariable UUID id, @Valid @RequestBody PromotionUpsertRequest request) {
        return ApiResponse.<PromotionResponse>builder().code(200).result(service.updateDraft(id, request)).build();
    }

    @PostMapping("/{id}/submit")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'PROMOTION_SUBMIT')")
    public ApiResponse<PromotionResponse> submit(@PathVariable UUID id,
                                                 @Valid @RequestBody PromotionNoteRequest request) {
        return ApiResponse.<PromotionResponse>builder().code(200)
                .result(service.submit(id, request.comment())).build();
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'PROMOTION_APPROVE')")
    public ApiResponse<PromotionResponse> approve(@PathVariable UUID id,
                                                  @Valid @RequestBody PromotionNoteRequest request) {
        return ApiResponse.<PromotionResponse>builder().code(200)
                .result(service.approve(id, request.comment())).build();
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'PROMOTION_APPROVE')")
    public ApiResponse<PromotionResponse> reject(@PathVariable UUID id,
                                                 @Valid @RequestBody PromotionReasonRequest request) {
        return ApiResponse.<PromotionResponse>builder().code(200)
                .result(service.reject(id, request.reason())).build();
    }

    @PostMapping("/{id}/activate")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'PROMOTION_ACTIVATE')")
    public ApiResponse<PromotionResponse> activate(@PathVariable UUID id) {
        return ApiResponse.<PromotionResponse>builder().code(200).result(service.activate(id)).build();
    }

    @PostMapping("/{id}/pause")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'PROMOTION_PAUSE')")
    public ApiResponse<PromotionResponse> pause(@PathVariable UUID id,
                                                @Valid @RequestBody PromotionReasonRequest request) {
        return ApiResponse.<PromotionResponse>builder().code(200)
                .result(service.pause(id, request.reason())).build();
    }

    @PostMapping("/{id}/archive")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'PROMOTION_ARCHIVE')")
    public ApiResponse<PromotionResponse> archive(@PathVariable UUID id,
                                                  @Valid @RequestBody PromotionReasonRequest request) {
        return ApiResponse.<PromotionResponse>builder().code(200)
                .result(service.archive(id, request.reason())).build();
    }
}
