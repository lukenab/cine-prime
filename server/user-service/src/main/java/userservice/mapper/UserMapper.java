package userservice.mapper;

import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;
import userservice.dto.UserResponse;
import userservice.dto.UserUpdateRequest;
import userservice.entity.User;

@Mapper(componentModel = "spring")
public interface UserMapper {

    @Mapping(target = "identityCard", expression = "java(userservice.util.IdentityCardMasker.mask(user.getIdentityCard()))")
    @Mapping(target = "profileCompleted", source = "profileCompleted")
    UserResponse toUserResponse(User user);

    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void updateUser(UserUpdateRequest request, @MappingTarget User user);
}
