package userservice.controller;

import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import userservice.dto.ApiResponse;
import userservice.dto.UserCreationRequest;
import userservice.dto.UserResponse;
import userservice.dto.UserUpdateRequest;
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

    @GetMapping("/{id}")
    public ApiResponse<UserResponse> getUserById(@PathVariable String id) {
        return ApiResponse.<UserResponse>builder()
                .result(userService.getUserById(id))
                .build();
    }
}
