package authservice.controller;

import authservice.dto.request.InternalAccountStatusRequest;
import authservice.dto.request.CreateAccountRequest;
import authservice.dto.response.AccountResponse;
import authservice.dto.response.InternalAccountResponse;
import authservice.service.AccountService;
import authservice.service.InternalServiceAuthenticator;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/internal/accounts")
@RequiredArgsConstructor
public class InternalAccountController {

    private final AccountService accountService;
    private final InternalServiceAuthenticator authenticator;

    @PostMapping("/invitations")
    ApiResponse<InternalAccountResponse> inviteStaff(
            @RequestHeader(value = "X-Internal-Service-Key", required = false) String internalKey,
            @Valid @RequestBody CreateAccountRequest request) {
        authenticator.verify(internalKey);
        AccountResponse account = accountService.createAccount(request);
        return ApiResponse.<InternalAccountResponse>builder()
                .result(InternalAccountResponse.builder()
                        .accountId(account.getAccountId())
                        .email(account.getEmail())
                        .status(account.getStatus())
                        .roles(account.getRoles().stream()
                                .map(role -> role.getRoleName())
                                .collect(java.util.stream.Collectors.toSet()))
                        .build())
                .build();
    }

    @GetMapping("/{accountId}")
    ApiResponse<InternalAccountResponse> getAccount(
            @PathVariable String accountId,
            @RequestHeader(value = "X-Internal-Service-Key", required = false) String internalKey) {
        authenticator.verify(internalKey);
        return ApiResponse.<InternalAccountResponse>builder()
                .result(accountService.getInternalAccount(accountId))
                .build();
    }

    @PatchMapping("/{accountId}/status")
    ApiResponse<Void> updateStatus(
            @PathVariable String accountId,
            @RequestHeader(value = "X-Internal-Service-Key", required = false) String internalKey,
            @Valid @RequestBody InternalAccountStatusRequest request) {
        authenticator.verify(internalKey);
        accountService.updateInternalStatus(accountId, request.getStatus());
        return ApiResponse.<Void>builder().message("Account status updated").build();
    }
}
