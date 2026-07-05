package authservice.service;

import authservice.dto.request.CreateRoleRequest;
import authservice.dto.response.RoleResponse;
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

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class RoleService {
    RoleRepository roleRepository;
    PermissionRepository permissionRepository;
    RoleMapper roleMapper;
    AuditLogService auditLogService;

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
}
