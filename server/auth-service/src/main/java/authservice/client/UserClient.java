package authservice.client;

import authservice.dto.response.UserExistenceResponse;
import authservice.dto.response.UserProfileResponse;
import movie.theater.common.dto.ApiResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

@FeignClient(name = "user-service")
public interface UserClient {
    @GetMapping("/api/users/check-existence")
    ApiResponse<UserExistenceResponse> checkExistence(
            @RequestParam("phoneNumber") String phoneNumber,
            @RequestParam("identityCard") String identityCard
    );

    @GetMapping("/api/users/{accountId}")
    ApiResponse<UserProfileResponse> getUser(@PathVariable("accountId") String accountId);
}

