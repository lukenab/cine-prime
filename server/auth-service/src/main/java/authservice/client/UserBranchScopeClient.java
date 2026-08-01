package authservice.client;

import authservice.dto.InternalBranchScopeResponse;
import movie.theater.common.dto.ApiResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;

@FeignClient(name = "user-service", path = "/api/internal/employees")
public interface UserBranchScopeClient {

    @GetMapping("/accounts/{accountId}/branch-scope")
    ApiResponse<InternalBranchScopeResponse> getBranchScope(
            @PathVariable("accountId") String accountId,
            @RequestHeader("X-Internal-Service-Key") String internalServiceKey);
}
