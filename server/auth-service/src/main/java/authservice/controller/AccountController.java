package authservice.controller;

import authservice.dto.request.UpdateAccountRequest;
import authservice.dto.request.CreateAccountRequest;
import authservice.dto.response.AccountResponse;
import authservice.service.AccountService;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/accounts")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AccountController {

    AccountService accountService;

    @GetMapping
    ApiResponse<List<AccountResponse>> getAllAccount(){
        return ApiResponse.<List<AccountResponse>>builder()
                .result(accountService.getAllAccount())
                .build();
    }

    @GetMapping("/{accountId}")
    ApiResponse<AccountResponse> getAccountById(@PathVariable String accountId){
        return ApiResponse.<AccountResponse>builder()
                .result(accountService.getAccountById(accountId))
                .build();
    }

    @PutMapping("/{accountId}")
    ApiResponse<AccountResponse> updateAccount(@PathVariable String accountId, @RequestBody UpdateAccountRequest request){
        return ApiResponse.<AccountResponse>builder()
                .result(accountService.updateAccount(accountId, request))
                .build();
    }

    @PostMapping
    ApiResponse<AccountResponse> createAccount(@RequestBody @Valid CreateAccountRequest request){
        return ApiResponse.<AccountResponse>builder()
                .result(accountService.createAccount(request))
                .build();
    }

    /**
     * Admin resends the activation email when the original link (24h TTL) expired
     * before the employee used it. See Issue #161.
     */
    @PostMapping("/{accountId}/resend-activation")
    ApiResponse<Void> resendActivation(@PathVariable String accountId){
        accountService.resendActivation(accountId);
        return ApiResponse.<Void>builder()
                .message("Activation email resent.")
                .build();
    }

    @GetMapping("/my-info")
    ApiResponse<AccountResponse> myInfo() {
        return ApiResponse.<AccountResponse>builder()
                .result(accountService.myInfo())
                .build();
    }
}
