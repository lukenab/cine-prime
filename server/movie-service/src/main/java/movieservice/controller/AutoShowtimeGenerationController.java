package movieservice.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import movieservice.dto.request.AutoShowtimeGenerationRequest;
import movieservice.dto.response.AutoShowtimeGenerationAcceptedResponse;
import movieservice.dto.response.AutoShowtimeGenerationPolicyResponse;
import movieservice.dto.response.AutoShowtimeGenerationRunResponse;
import movieservice.service.AutoShowtimeGenerationService;
import movieservice.service.autoshowtime.AutoShowtimeExecutionResult;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/schedules/auto-generation-runs")
@RequiredArgsConstructor
public class AutoShowtimeGenerationController {

    private final AutoShowtimeGenerationService autoShowtimeGenerationService;

    /// Nhận scope movie/cluster/date và tạo generation run ở trạng thái ACCEPTED.
    /// Request idempotent sẽ trả lại run cũ thay vì tạo một run trùng.
    @PostMapping
    @ResponseStatus(HttpStatus.ACCEPTED)
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'SCHEDULE_PLAN_SUBMIT')")
    public ApiResponse<AutoShowtimeGenerationAcceptedResponse> submit(
            @Valid @RequestBody AutoShowtimeGenerationRequest request,
            Authentication authentication
    ) {
        return ApiResponse.<AutoShowtimeGenerationAcceptedResponse>builder()
                .code(HttpStatus.ACCEPTED.value())
                .message("Auto showtime generation run accepted")
                .result(autoShowtimeGenerationService.submitRun(request, actor(authentication)))
                .build();
    }

    /// Endpoint vận hành/test để thực thi một run ACCEPTED ngay lập tức.
    /// Sau này scheduled job có thể gọi đúng executeRun() này mà không lặp business logic.
    @PostMapping("/{generationRunId}/execute")
    @PreAuthorize("@autoShowtimeManualExecutionAccess.canExecute(authentication)")
    public ApiResponse<AutoShowtimeExecutionResult> execute(
            @PathVariable Long generationRunId
    ) {
        return ApiResponse.<AutoShowtimeExecutionResult>builder()
                .code(HttpStatus.OK.value())
                .message("Auto showtime generation run processed")
                .result(autoShowtimeGenerationService.executeRun(generationRunId))
                .build();
    }

    /// Client gọi endpoint này để hiển thị khoảng ngày hợp lệ (D+start ~ D+end) ngay ở bước
    /// chọn Planning window, thay vì chỉ biết được sau khi submit bị INVALID_GENERATION_RANGE.
    @GetMapping("/policy")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'SCHEDULE_PLAN_SUBMIT', 'SCHEDULE_PLAN_APPROVE')")
    public ApiResponse<AutoShowtimeGenerationPolicyResponse> getActivePolicy() {
        return ApiResponse.<AutoShowtimeGenerationPolicyResponse>builder()
                .code(HttpStatus.OK.value())
                .result(autoShowtimeGenerationService.getActivePolicySummary())
                .build();
    }

    /// Client dùng endpoint này để poll status/count sau POST submit hoặc execute.
    @GetMapping("/{generationRunId}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'SCHEDULE_PLAN_SUBMIT', 'SCHEDULE_PLAN_APPROVE')")
    public ApiResponse<AutoShowtimeGenerationRunResponse> getById(
            @PathVariable Long generationRunId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ApiResponse.<AutoShowtimeGenerationRunResponse>builder()
                .code(HttpStatus.OK.value())
                .result(autoShowtimeGenerationService.getRun(generationRunId, page, size))
                .build();
    }

    /// Lấy username từ Spring Security để audit requested_by; fallback chỉ phục vụ local development.
    private String actor(Authentication authentication) {
        return authentication != null ? authentication.getName() : "system";
    }
}
