package authservice.controller;

import authservice.dto.request.AccountUpdateRequest;
import authservice.dto.request.RegisterRequest;
import authservice.dto.response.AccountResponse;
import authservice.entity.Account;
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
    ApiResponse<AccountResponse> updateAccount(@PathVariable String accountId, @RequestBody AccountUpdateRequest request){
        return ApiResponse.<AccountResponse>builder()
                .result(accountService.updateAccount(accountId, request))
                .build();
    }

    @PostMapping
    ApiResponse<AccountResponse> createAccount(@RequestBody @Valid RegisterRequest request){
        return ApiResponse.<AccountResponse>builder()
                .result(accountService.createAccount(request))
                .build();
    }
}
