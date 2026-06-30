package userservice.mapper;

import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;
import userservice.dto.EmployeeResponse;
import userservice.dto.EmployeeUpdateRequest;
import userservice.entity.Employee;

@Mapper(componentModel = "spring")
public interface EmployeeMapper {

    @Mapping(source = "user.accountId",    target = "accountId")
    @Mapping(source = "user.fullName",     target = "fullName")
    @Mapping(source = "user.phoneNumber",  target = "phoneNumber")
    @Mapping(source = "user.dateOfBirth",  target = "dateOfBirth")
    @Mapping(source = "user.gender",       target = "gender")
    @Mapping(source = "user.address",      target = "address")
    @Mapping(target = "identityCard", expression = "java(employee.getUser() == null ? null : userservice.util.IdentityCardMasker.mask(employee.getUser().getIdentityCard()))")
    @Mapping(source = "user.avatarUrl",    target = "avatarUrl")
    EmployeeResponse toEmployeeResponse(Employee employee);

    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void updateEmployee(EmployeeUpdateRequest request, @MappingTarget Employee employee);
}
