package authservice.mapper;

import authservice.dto.request.CreatePermissionRequest;
import authservice.dto.response.PermissionResponse;
import authservice.entity.Permission;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "spring")
public interface PermissionMapper {
    Permission toPermission(CreatePermissionRequest request);

    @Mapping(source = "name", target = "permissionName")
    PermissionResponse toPermissionResponse(Permission permission);

    List<PermissionResponse> permissionResponseList(List<Permission> permissionList);
}
