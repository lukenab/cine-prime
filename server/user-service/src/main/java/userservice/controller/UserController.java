package userservice.controller;

import movie.theater.common.dto.ApiResponse;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import userservice.dto.PageResponse;
import userservice.dto.UserResponse;
import userservice.dto.UserUpdateRequest;
import userservice.service.UserService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@RequestMapping("/api/users")
public class UserController {
    UserService userService;

    @GetMapping("/{id}")
    public ApiResponse<UserResponse> getUserById(@PathVariable String id){
        return ApiResponse.<UserResponse>builder()
                .result(userService.getUserById(id))
                .build();
    }

    @PutMapping("/{id}")
    public ApiResponse<UserResponse> updateUser(@PathVariable String id, @Valid @RequestBody UserUpdateRequest request){
        return ApiResponse.<UserResponse>builder()
                .result(userService.updateUser(id, request))
                .build();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<UserResponse> deleteUser(@PathVariable String id){
        userService.softDeleteUser(id);
        return ApiResponse.<UserResponse>builder()
                .message("User has been deleted")
                .build();
    }

    @GetMapping()
    public ApiResponse<PageResponse<UserResponse>> getAllUsers(
            @RequestParam(value = "page", defaultValue = "1") int page,
            @RequestParam(value = "size", defaultValue = "10") int size
    ){
        return ApiResponse.<PageResponse<UserResponse>>builder()
                .result(userService.getAllUser(page, size))
                .build();
    }

    @GetMapping("/check-existence")
    public ApiResponse<Map<String, Boolean>> checkExistence(
            @RequestParam("phoneNumber") String phoneNumber,
            @RequestParam("identityCard") String identityCard) {

        Map<String, Boolean> result = userService.checkUserExistence(phoneNumber, identityCard);

        return ApiResponse.<Map<String, Boolean>>builder()
                .result(result)
                .build();
    }
}
