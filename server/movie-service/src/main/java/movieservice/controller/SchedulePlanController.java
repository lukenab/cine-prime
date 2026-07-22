package movieservice.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import movieservice.dto.request.SchedulePlanReviewRequest;
import movieservice.dto.response.SchedulePlanResponse;
import movieservice.service.SchedulePlanService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/schedule-plans")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class SchedulePlanController {
    private final SchedulePlanService schedulePlanService;

    @GetMapping("/{planId}")
    public ApiResponse<SchedulePlanResponse> get(@PathVariable Long planId) {
        return ok(schedulePlanService.get(planId));
    }

    @PostMapping("/{planId}/submit-review")
    public ApiResponse<SchedulePlanResponse> submitReview(
            @PathVariable Long planId,
            @Valid @RequestBody(required = false) SchedulePlanReviewRequest request,
            Authentication authentication) {
        return ok(schedulePlanService.submitReview(
                planId, actor(authentication), request == null ? null : request.note()));
    }

    @PostMapping("/{planId}/request-changes")
    public ApiResponse<SchedulePlanResponse> requestChanges(
            @PathVariable Long planId,
            @Valid @RequestBody(required = false) SchedulePlanReviewRequest request,
            Authentication authentication) {
        return ok(schedulePlanService.requestChanges(
                planId, actor(authentication), request == null ? null : request.note()));
    }

    @PostMapping("/{planId}/publish")
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

