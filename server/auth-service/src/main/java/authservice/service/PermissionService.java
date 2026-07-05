package authservice.service;

import authservice.dto.request.CreatePermissionRequest;
import authservice.dto.response.PermissionResponse;
import authservice.entity.Permission;
import authservice.mapper.PermissionMapper;
import authservice.repository.PermissionRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class PermissionService {

    PermissionRepository permissionRepository;
    PermissionMapper permissionMapper;
    AuditLogService auditLogService;

    public PermissionResponse createPermission(CreatePermissionRequest request){
        Permission permission = permissionMapper.toPermission(request);

        Permission savedPermission = permissionRepository.save(permission);
        auditLogService.success("PERMISSION_CREATED", null, "Permission created",
                auditLogService.metadata("permission", savedPermission.getName()));

        return permissionMapper.toPermissionResponse(savedPermission);
    }

    public List<PermissionResponse> getAllPermission(){
        return permissionMapper.permissionResponseList(permissionRepository.findAll());
    }

    public void deletePermission(String permission){
        permissionRepository.deleteById(permission);
        auditLogService.success("PERMISSION_DELETED", null, "Permission deleted",
                auditLogService.metadata("permission", permission));
    }
}
