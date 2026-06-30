package authservice.service;

import authservice.dto.request.PermissionRequest;
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
    AuthAuditLogService authAuditLogService;

    public PermissionResponse createPermission(PermissionRequest request){
        Permission permission = permissionMapper.toPermission(request);

        Permission savedPermission = permissionRepository.save(permission);
        authAuditLogService.success("PERMISSION_CREATED", null, "Permission created",
                authAuditLogService.metadata("permission", savedPermission.getName()));

        return permissionMapper.toPermissionResponse(savedPermission);
    }

    public List<PermissionResponse> getAllPermission(){
        return permissionMapper.permissionResponseList(permissionRepository.findAll());
    }

    public void deletePermission(String permission){
        permissionRepository.deleteById(permission);
        authAuditLogService.success("PERMISSION_DELETED", null, "Permission deleted",
                authAuditLogService.metadata("permission", permission));
    }
}
