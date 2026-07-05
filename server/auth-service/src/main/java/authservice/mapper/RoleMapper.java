package authservice.mapper;

import authservice.dto.request.CreateRoleRequest;
import authservice.dto.response.RoleResponse;
import authservice.entity.Role;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "spring")
public interface RoleMapper {
    @Mapping(target = "permissions", ignore = true)
    Role toRole(CreateRoleRequest createRoleRequest);
    RoleResponse toRoleResponse(Role role);
    List<RoleResponse> toRoleResponseList(List<Role> roles);
}
