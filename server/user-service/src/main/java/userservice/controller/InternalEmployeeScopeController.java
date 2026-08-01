package userservice.controller;

import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import movie.theater.common.exception.AppException;
import movie.theater.common.exception.GlobalErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import userservice.dto.InternalBranchScopeResponse;
import userservice.enums.EmployeeStatus;
import userservice.repository.EmployeeRepository;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

@RestController
@RequestMapping("/api/internal/employees")
@RequiredArgsConstructor
public class InternalEmployeeScopeController {
    private final EmployeeRepository employeeRepository;

    @Value("${app.internal-service-key}")
    private String configuredInternalKey;

    @GetMapping("/accounts/{accountId}/branch-scope")
    public ApiResponse<InternalBranchScopeResponse> branchScope(
            @PathVariable String accountId,
            @RequestHeader(value = "X-Internal-Service-Key", required = false) String providedKey) {
        requireInternalCredential(providedKey);
        List<String> clusterIds = employeeRepository.findByUser_AccountId(accountId)
                .filter(employee -> employee.getStatus() == EmployeeStatus.ACTIVE)
                .map(employee -> employee.getCinemaId() == null || employee.getCinemaId().isBlank()
                        ? List.<String>of()
                        : List.of(employee.getCinemaId().trim()))
                .orElseGet(List::of);
        return ApiResponse.<InternalBranchScopeResponse>builder()
                .result(new InternalBranchScopeResponse(clusterIds))
                .build();
    }

    private void requireInternalCredential(String providedKey) {
        if (providedKey == null || configuredInternalKey == null
                || !MessageDigest.isEqual(
                providedKey.getBytes(StandardCharsets.UTF_8),
                configuredInternalKey.getBytes(StandardCharsets.UTF_8))) {
            throw new AppException(GlobalErrorCode.UNAUTHENTICATED);
        }
    }
}
