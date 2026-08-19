package authservice.controller;

import authservice.dto.request.CreateRoleRequest;
import authservice.dto.response.RoleResponse;
import authservice.dto.request.UpdateRolePermissionsRequest;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import authservice.service.RoleService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/roles")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class RoleController {

    RoleService roleService;

    @PostMapping
    ApiResponse<RoleResponse> createRole(@RequestBody CreateRoleRequest request){
        return ApiResponse.<RoleResponse>builder()
                .result(roleService.createRole(request))
                .build();
    }

    @GetMapping
    ApiResponse<List<RoleResponse>> getAllPermission() {
        return ApiResponse.<List<RoleResponse>>builder()
                .result(roleService.getAllRoles())
                .build();
    }

    @PutMapping("/{roleName}/permissions")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_SYSTEM_ADMIN','ROLE_MANAGE')")
    ApiResponse<RoleResponse> updatePermissions(
            @PathVariable String roleName,
            @Valid @RequestBody UpdateRolePermissionsRequest request) {
        return ApiResponse.<RoleResponse>builder()
                .message("Role permission matrix updated")
                .result(roleService.updatePermissions(roleName, request)).build();
    }
}
