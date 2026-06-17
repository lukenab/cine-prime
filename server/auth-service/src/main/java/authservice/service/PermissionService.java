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

    public PermissionResponse createPermission(PermissionRequest request){
        Permission permission = permissionMapper.toPermission(request);

        return permissionMapper.toPermissionResponse(permissionRepository.save(permission));
    }

    public List<PermissionResponse> getAllPermission(){
        return permissionMapper.permissionResponseList(permissionRepository.findAll());
    }

    public void deletePermission(String permission){
        permissionRepository.deleteById(permission);
    }
}
