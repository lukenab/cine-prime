package authservice.mapper;

import authservice.dto.request.RegisterRequest;
import authservice.dto.response.RegisterResponse;
import authservice.entity.Account;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface AccountMapper {
    Account toAccount(RegisterRequest registerRequest);
    RegisterResponse toRegisterResponse(Account account);
}
