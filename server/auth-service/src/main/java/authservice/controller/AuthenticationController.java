package authservice.controller;

import authservice.dto.request.AuthenticationRequest;
import authservice.dto.request.RegisterRequest;
import authservice.dto.request.VerifyOtpRequest;
import authservice.dto.response.AuthenticationResponse;
import authservice.dto.response.RegisterResponse;
import authservice.entity.Account;
import authservice.service.AuthenticationService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AuthenticationController {
    AuthenticationService authenticationService;

    @PostMapping("/register/initiate")
    ApiResponse<String> initiateRegistration(@RequestBody RegisterRequest request) {
        authenticationService.initiateRegistration(request);
        return ApiResponse.<String>builder()
                .result("OTP has been sent to your email")
                .build();
    }

    @PostMapping("/register/verify")
    ApiResponse<RegisterResponse> verifyAndRegister(@RequestBody VerifyOtpRequest request) {
        return ApiResponse.<RegisterResponse>builder()
                .result(authenticationService.verifyOtpAndRegister(request))
                .build();
    }

    @PostMapping("/login")
    ApiResponse<AuthenticationResponse> authenticate(@RequestBody AuthenticationRequest request) {
        return ApiResponse.<AuthenticationResponse>builder()
                .result(authenticationService.authenticate(request))
                .build();
    }
//
//    @GetMapping("/myInfo")
//    ApiResponse<RegisterResponse> myInfo() {
//        return ApiResponse.<RegisterResponse>builder()
//                .result(authenticationService.myInfo())
//                .build();
//    }
//
//    @GetMapping("/accounts")
//    List<Account> getAll(){
//        return authenticationService.getAllAccount();
//    }
}
