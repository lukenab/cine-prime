package userservice.controller;

import movie.theater.common.dto.ApiResponse;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import jakarta.validation.Valid;
import userservice.dto.PageResponse;
import userservice.dto.UserResponse;
import userservice.dto.UserUpdateRequest;
import userservice.service.UserService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;

import userservice.dto.UserExistenceResponse;

@RestController
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@RequestMapping("/api/users")
public class UserController {
    UserService userService;

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN') or #id == authentication.principal.claims['accountId']")
    public ApiResponse<UserResponse> getUserById(@PathVariable String id){
        return ApiResponse.<UserResponse>builder()
                .result(userService.getUserById(id))
                .build();
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN') or #id == authentication.principal.claims['accountId']")
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
            @RequestParam(value = "size", defaultValue = "10") int size,
            @RequestParam(value = "query", required = false) String query,
            @RequestParam(value = "active", required = false) Boolean active
    ){
        return ApiResponse.<PageResponse<UserResponse>>builder()
                .result(userService.getAllUser(page, size, query, active))
                .build();
    }

    @PostMapping(value = "/{id}/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN') or #id == authentication.principal.claims['accountId']")
    public ApiResponse<UserResponse> uploadAvatar(
            @PathVariable String id,
            @RequestParam("file") MultipartFile file) {
        return ApiResponse.<UserResponse>builder()
                .result(userService.uploadAvatar(id, file))
                .message("Avatar updated successfully")
                .build();
    }

    @GetMapping("/check-existence")
    public ApiResponse<UserExistenceResponse> checkExistence(
            @RequestParam("phoneNumber") String phoneNumber,
            @RequestParam("identityCard") String identityCard) {

        var result = userService.checkUserExistence(phoneNumber, identityCard);

        return ApiResponse.<UserExistenceResponse>builder()
                .result(UserExistenceResponse.builder()
                        .phoneExists(Boolean.TRUE.equals(result.get("phoneExists")))
                        .identityCardExists(Boolean.TRUE.equals(result.get("identityCardExists")))
                        .build())
                .build();
    }
}
