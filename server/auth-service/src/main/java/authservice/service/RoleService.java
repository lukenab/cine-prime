package authservice.service;

import authservice.dto.request.CreateRoleRequest;
import authservice.dto.response.RoleResponse;
import authservice.dto.request.UpdateRolePermissionsRequest;
import authservice.entity.Account;
import authservice.exception.AuthErrorCode;
import authservice.repository.AccountRepository;
import movie.theater.common.exception.AppException;
import movie.theater.common.security.JwtSecurityUtils;
import org.springframework.transaction.annotation.Transactional;
import authservice.entity.Permission;
import authservice.entity.Role;
import authservice.mapper.RoleMapper;
import authservice.repository.PermissionRepository;
import authservice.repository.RoleRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class RoleService {
    RoleRepository roleRepository;
    PermissionRepository permissionRepository;
    RoleMapper roleMapper;
    AuditLogService auditLogService;
    AccountRepository accountRepository;
    private static final Set<String> PROTECTED_ROLES = Set.of("SUPER_ADMIN", "ADMIN", "SYSTEM_ADMIN", "MEMBER");

    public RoleResponse createRole(CreateRoleRequest request){
        Role role = roleMapper.toRole(request);

        List<Permission> permissions = permissionRepository.findAllById(request.getPermissions());
        role.setPermissions(new HashSet<>(permissions));

        role = roleRepository.save(role);
        auditLogService.success("ROLE_CREATED", null, "Role created",
                auditLogService.metadata(
                        "roleName", role.getRoleName(),
                        "permissions", request.getPermissions()
                ));

        return roleMapper.toRoleResponse(role);
    }

    public List<RoleResponse> getAllRoles(){
        return roleMapper.toRoleResponseList(roleRepository.findAll());
    }

    @Transactional
    public RoleResponse updatePermissions(String roleName, UpdateRolePermissionsRequest request) {
        String normalized = roleName.trim().toUpperCase();
        if (PROTECTED_ROLES.contains(normalized)) {
            throw new AppException(AuthErrorCode.PROTECTED_ROLE_CHANGE_FORBIDDEN);
        }
        Role role = roleRepository.findById(normalized)
                .orElseThrow(() -> new AppException(AuthErrorCode.ROLE_NOT_FOUND));
        String actorId = JwtSecurityUtils.getCurrentAccountId();
        Account actor = actorId == null ? null : accountRepository.findById(actorId).orElse(null);
        if (actor != null && actor.getRoles().stream().anyMatch(item -> normalized.equals(item.getRoleName()))) {
            throw new AppException(AuthErrorCode.SELF_ROLE_CHANGE_FORBIDDEN);
        }
        List<Permission> permissions = permissionRepository.findAllById(request.getPermissions());
        if (permissions.size() != request.getPermissions().stream().distinct().count()) {
            throw new AppException(AuthErrorCode.ROLE_NOT_FOUND);
        }
        Set<String> previous = role.getPermissions().stream().map(Permission::getName).collect(Collectors.toSet());
        role.setPermissions(new HashSet<>(permissions));
        Role saved = roleRepository.save(role);
        auditLogService.success("ROLE_PERMISSIONS_UPDATED", null, "Role permission matrix updated",
                auditLogService.metadata("roleName", normalized, "oldPermissions", previous,
                        "newPermissions", request.getPermissions()));
        return roleMapper.toRoleResponse(saved);
    }
}
