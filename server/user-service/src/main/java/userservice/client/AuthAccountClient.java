package userservice.client;

import movie.theater.common.dto.ApiResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestBody;
import userservice.dto.AuthAccountSummary;
import userservice.dto.AuthAccountStatusRequest;
import userservice.dto.AuthAccountInvitationRequest;
import userservice.dto.AuthStaffRoleRequest;

@FeignClient(name = "auth-service", path = "/api/internal/accounts")
public interface AuthAccountClient {

    @PostMapping("/invitations")
    ApiResponse<AuthAccountSummary> inviteStaff(
            @RequestHeader("X-Internal-Service-Key") String internalKey,
            @RequestBody AuthAccountInvitationRequest request);

    @GetMapping("/{accountId}")
    ApiResponse<AuthAccountSummary> getAccount(
            @PathVariable String accountId,
            @RequestHeader("X-Internal-Service-Key") String internalKey);

    @PatchMapping("/{accountId}/status")
    ApiResponse<Void> updateStatus(
            @PathVariable String accountId,
            @RequestHeader("X-Internal-Service-Key") String internalKey,
            @RequestBody AuthAccountStatusRequest request);

    @PatchMapping("/{accountId}/staff-role")
    ApiResponse<Void> updateStaffRole(
            @PathVariable String accountId,
            @RequestHeader("X-Internal-Service-Key") String internalKey,
            @RequestBody AuthStaffRoleRequest request);
}
