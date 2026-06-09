package authservice.repository;

import authservice.dto.request.UserCreationRequest;
import jakarta.validation.Valid;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.stereotype.Repository;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "user-service")
public interface UserProfileClient {

    @PostMapping("/api/users/profile")
    void createProfile(@Valid @RequestBody UserCreationRequest request);
}
