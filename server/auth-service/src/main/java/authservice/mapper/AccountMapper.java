package authservice.mapper;

import authservice.dto.request.AccountUpdateRequest;
import authservice.dto.request.RegisterRequest;
import authservice.dto.response.AccountResponse;
import authservice.entity.Account;
import org.mapstruct.*;

import java.util.List;

@Mapper(
        componentModel = "spring",
        unmappedTargetPolicy = ReportingPolicy.IGNORE,
        nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE
)
public interface AccountMapper {
    Account toAccount(RegisterRequest registerRequest);
    AccountResponse toAccountResponse(Account account);
    List<AccountResponse> toAccountResponseList(List<Account> accounts);

    @Mapping(target = "roles", ignore = true)
    @Mapping(target = "passwordHash", ignore = true)
    void updateAccount(AccountUpdateRequest request, @MappingTarget Account account);
}
