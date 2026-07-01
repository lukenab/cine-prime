package authservice.controller;

import authservice.dto.request.RegisterRequest;
import authservice.dto.request.ResendOtpRequest;
import authservice.dto.request.VerifyOtpRequest;
import authservice.dto.response.RegisterResponse;
import authservice.service.AuthenticationService;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class RegisterController {

    AuthenticationService authenticationService;

    @GetMapping("/check")
    ApiResponse<Void> checkFieldAvailability(
            @RequestParam(required = false) String username,
            @RequestParam(required = false) String email) {
        authenticationService.checkFieldAvailability(username, email);
        return ApiResponse.<Void>builder().message("Available").build();
    }

    @PostMapping("/register/initiate")
    ApiResponse<String> initiateRegistration(@Valid @RequestBody RegisterRequest request) {
        authenticationService.initiateRegistration(request);
        return ApiResponse.<String>builder()
                .result("OTP has been sent to your email")
                .build();
    }

    @PostMapping("/register/verify")
    ApiResponse<RegisterResponse> verifyAndRegister(@Valid @RequestBody VerifyOtpRequest request) {
        return ApiResponse.<RegisterResponse>builder()
                .result(authenticationService.verifyOtpAndRegister(request))
                .build();
    }

    @PostMapping("/resend-otp")
    ApiResponse<Void> resendOtp(@Valid @RequestBody ResendOtpRequest request) {
        authenticationService.resendOtp(request);
        return ApiResponse.<Void>builder()
                .message("New OTP has been sent to your email!")
                .build();
    }
}
