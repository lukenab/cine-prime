package movieservice.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import movieservice.dto.request.SchedulePlanReviewRequest;
import movieservice.dto.response.SchedulePlanResponse;
import movieservice.dto.response.SchedulePlanSummaryResponse;
import movieservice.enums.SchedulePlanStatus;
import movieservice.service.SchedulePlanService;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/schedule-plans")
@RequiredArgsConstructor
public class SchedulePlanController {
    private final SchedulePlanService schedulePlanService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'PROGRAMMING_OPERATOR')")
    public ApiResponse<Page<SchedulePlanSummaryResponse>> list(
            @RequestParam(required = false) SchedulePlanStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.<Page<SchedulePlanSummaryResponse>>builder()
                .code(HttpStatus.OK.value())
                .result(schedulePlanService.list(status, page, size))
                .build();
    }

    @GetMapping("/{planId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'PROGRAMMING_OPERATOR')")
    public ApiResponse<SchedulePlanResponse> get(@PathVariable Long planId) {
        return ok(schedulePlanService.get(planId));
    }

    @PostMapping("/{planId}/revalidate")
    @PreAuthorize("hasAnyRole('ADMIN', 'PROGRAMMING_OPERATOR')")
    public ApiResponse<SchedulePlanResponse> revalidate(
            @PathVariable Long planId,
            Authentication authentication) {
        return ok(schedulePlanService.revalidate(planId, actor(authentication)));
    }

    @PostMapping("/{planId}/submit-review")
    @PreAuthorize("hasAnyRole('ADMIN', 'PROGRAMMING_OPERATOR')")
    public ApiResponse<SchedulePlanResponse> submitReview(
            @PathVariable Long planId,
            @Valid @RequestBody(required = false) SchedulePlanReviewRequest request,
            Authentication authentication) {
        return ok(schedulePlanService.submitReview(
                planId, actor(authentication), request == null ? null : request.note()));
    }

    @PostMapping("/{planId}/request-changes")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<SchedulePlanResponse> requestChanges(
            @PathVariable Long planId,
            @Valid @RequestBody(required = false) SchedulePlanReviewRequest request,
            Authentication authentication) {
        return ok(schedulePlanService.requestChanges(
                planId, actor(authentication), request == null ? null : request.note()));
    }

    @PostMapping("/{planId}/publish")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<SchedulePlanResponse> publish(
            @PathVariable Long planId,
            Authentication authentication) {
        return ok(schedulePlanService.publish(planId, actor(authentication)));
    }

    private ApiResponse<SchedulePlanResponse> ok(SchedulePlanResponse response) {
        return ApiResponse.<SchedulePlanResponse>builder()
                .code(HttpStatus.OK.value()).result(response).build();
    }

    private String actor(Authentication authentication) {
        return authentication == null ? "system" : authentication.getName();
    }
}
