package userservice.mapper;

import org.mapstruct.Mapper;

import userservice.dto.UserCreationRequest;
import userservice.dto.UserResponse;
import userservice.entity.User;

@Mapper(componentModel = "spring")
public interface UserMapper {
    User toUser(UserCreationRequest request);
    UserResponse toUserResponse(User user);
}
