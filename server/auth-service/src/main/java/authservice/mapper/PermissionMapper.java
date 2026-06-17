package authservice.mapper;

import authservice.dto.request.PermissionRequest;
import authservice.dto.response.PermissionResponse;
import authservice.entity.Permission;
import org.mapstruct.Mapper;

import java.util.List;

@Mapper(componentModel = "spring")
public interface PermissionMapper {
    Permission toPermission(PermissionRequest request);

    PermissionResponse toPermissionResponse(Permission permission);

    List<PermissionResponse> permissionResponseList(List<Permission> permissionList);
}
