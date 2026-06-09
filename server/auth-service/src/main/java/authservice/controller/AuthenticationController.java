package authservice.controller;

import authservice.dto.request.AuthenticationRequest;
import authservice.dto.request.RegisterRequest;
import authservice.dto.response.ApiResponse;
import authservice.dto.response.AuthenticationResponse;
import authservice.dto.response.RegisterResponse;
import authservice.service.AuthenticationService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AuthenticationController {
    AuthenticationService authenticationService;

    @PostMapping("/register")
    ApiResponse<RegisterResponse> registerAccount(@RequestBody RegisterRequest request){
        return ApiResponse.<RegisterResponse>builder()
                .result(authenticationService.registerAccount(request))
                .build();
    }

    @PostMapping("/login")
    ApiResponse<AuthenticationResponse> authenticate(@RequestBody AuthenticationRequest request){
        return ApiResponse.<AuthenticationResponse>builder()
                .result(authenticationService.authenticate(request))
                .build();
    }

//    @GetMapping("/{accountId}")
//    RegisterResponse getAccountById(@PathVariable String accountId){
//        return authenticationService.getAccountById(accountId);
//    }
}
