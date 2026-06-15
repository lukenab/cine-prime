package userservice.mapper;

import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;

import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;
import userservice.dto.UserCreationRequest;
import userservice.dto.UserResponse;
import userservice.dto.UserUpdateRequest;
import userservice.entity.User;

@Mapper(componentModel = "spring")
public interface UserMapper {
    User toUser(UserCreationRequest request);
    UserResponse toUserResponse(User user);

    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void updateUser(UserUpdateRequest request, @MappingTarget User user);
}
