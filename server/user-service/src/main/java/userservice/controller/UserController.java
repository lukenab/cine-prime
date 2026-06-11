package userservice.controller;

import movie.theater.common.dto.ApiResponse;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import userservice.dto.UserCreationRequest;
import userservice.dto.UserResponse;
import userservice.service.UserService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
@RestController
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@RequestMapping("/api/users")
public class UserController {
    UserService userService;

    @PostMapping("/profile")
    public ApiResponse<UserResponse> createProfile(@Valid @RequestBody UserCreationRequest request) {
        return ApiResponse.<UserResponse>builder()
        .result(userService.create(request))
        .build();
    }
}
