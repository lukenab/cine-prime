package movieservice.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import movieservice.dto.request.ShowtimeAllocationPolicyRequest;
import movieservice.dto.response.ShowtimeAllocationPolicyResponse;
import movieservice.service.ShowtimeAllocationPolicyAdminService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Admin CRUD for {@code ShowtimeAllocationPolicy} - previously only readable via
 * {@code GET /api/schedules/auto-generation-runs/policy} (planning-horizon summary only), with
 * no way to create or edit a policy except direct DB access.
 */
@RestController
@RequestMapping("/api/schedules/allocation-policies")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class ShowtimeAllocationPolicyController {

    private final ShowtimeAllocationPolicyAdminService policyAdminService;

    @GetMapping
    public ApiResponse<List<ShowtimeAllocationPolicyResponse>> listAll() {
        return ApiResponse.<List<ShowtimeAllocationPolicyResponse>>builder()
                .code(HttpStatus.OK.value())
                .result(policyAdminService.listAll())
                .build();
    }

    @GetMapping("/{policyId}")
    public ApiResponse<ShowtimeAllocationPolicyResponse> getById(@PathVariable Long policyId) {
        return ApiResponse.<ShowtimeAllocationPolicyResponse>builder()
                .code(HttpStatus.OK.value())
                .result(policyAdminService.getById(policyId))
                .build();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ShowtimeAllocationPolicyResponse> create(
            @Valid @RequestBody ShowtimeAllocationPolicyRequest request,
            Authentication authentication
    ) {
        return ApiResponse.<ShowtimeAllocationPolicyResponse>builder()
                .code(HttpStatus.CREATED.value())
                .message("Showtime allocation policy created")
                .result(policyAdminService.create(request, actor(authentication)))
                .build();
    }

    @PutMapping("/{policyId}")
    public ApiResponse<ShowtimeAllocationPolicyResponse> update(
            @PathVariable Long policyId,
            @Valid @RequestBody ShowtimeAllocationPolicyRequest request,
            Authentication authentication
    ) {
        return ApiResponse.<ShowtimeAllocationPolicyResponse>builder()
                .code(HttpStatus.OK.value())
                .message("Showtime allocation policy updated")
                .result(policyAdminService.update(policyId, request, actor(authentication)))
                .build();
    }

    /// Sets this policy active and deactivates any other active row sharing the same
    /// policy_code - see ShowtimeAllocationPolicyAdminService#activate for why that matters
    /// (auto showtime generation always reads policy_code="DEFAULT" + active=true).
    @PostMapping("/{policyId}/activate")
    public ApiResponse<ShowtimeAllocationPolicyResponse> activate(
            @PathVariable Long policyId,
            Authentication authentication
    ) {
        return ApiResponse.<ShowtimeAllocationPolicyResponse>builder()
                .code(HttpStatus.OK.value())
                .message("Showtime allocation policy activated")
                .result(policyAdminService.activate(policyId, actor(authentication)))
                .build();
    }

    private String actor(Authentication authentication) {
        return authentication != null ? authentication.getName() : "system";
    }
}
