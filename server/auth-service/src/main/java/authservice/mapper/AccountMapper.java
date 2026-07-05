package authservice.mapper;

import authservice.dto.request.RegisterRequest;
import authservice.dto.response.AccountResponse;
import authservice.dto.response.RegisterResponse;
import authservice.entity.Account;
import org.mapstruct.*;

import java.util.List;

@Mapper(componentModel = "spring")
public interface AccountMapper {
    Account toAccount(RegisterRequest registerRequest);

    @Mapping(target = "createdAt", expression = "java(account.getCreatedAt() != null ? account.getCreatedAt().atOffset(java.time.ZoneOffset.ofHours(7)) : null)")
    AccountResponse toAccountResponse(Account account);

    List<AccountResponse> toAccountResponseList(List<Account> accounts);

    @Mapping(target = "createdAt", expression = "java(account.getCreatedAt() != null ? account.getCreatedAt().atOffset(java.time.ZoneOffset.ofHours(7)) : null)")
    RegisterResponse toRegisterResponse(Account account);

}
