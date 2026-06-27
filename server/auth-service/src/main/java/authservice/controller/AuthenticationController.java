package authservice.controller;

import authservice.dto.request.*;
import authservice.dto.response.AuthenticationResponse;
import authservice.dto.response.AccountResponse;
import authservice.dto.response.IntrospectResponse;
import authservice.service.AuthenticationService;
import com.nimbusds.jose.JOSEException;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;
import org.springframework.web.bind.annotation.*;

import java.text.ParseException;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AuthenticationController {
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
    ApiResponse<AccountResponse> verifyAndRegister(@Valid @RequestBody VerifyOtpRequest request) {
        return ApiResponse.<AccountResponse>builder()
                .result(authenticationService.verifyOtpAndRegister(request))
                .build();
    }

    @PostMapping("/login")
    ApiResponse<AuthenticationResponse> authenticate(@RequestBody AuthenticationRequest request) {
        System.out.println(request + " dong 50");
        return ApiResponse.<AuthenticationResponse>builder()
                .result(authenticationService.authenticate(request))
                .build();
    }

    @PostMapping("/resend-otp")
    public ApiResponse<?> resendOtp(@Valid @RequestBody ResendOtpRequest request){
        authenticationService.resendOtp(request);
        return ApiResponse.builder()
                .message("New otp has been sent to your email!")
                .build();
    }

    @PostMapping("/logout")
    ApiResponse<Void> logout(@RequestBody LogoutRequest request) throws ParseException, JOSEException {
        authenticationService.logout(request);
        return ApiResponse.<Void>builder()
                .message("Logged out successfully")
                .build();
    }

    @PostMapping("/introspect")
    public ApiResponse<IntrospectResponse> introspect(@RequestBody IntrospectRequest request) {
        return ApiResponse.<IntrospectResponse>builder()
                .result(authenticationService.introspect(request))
                .build();
    }

    @PostMapping("/refresh")
    public ApiResponse<AuthenticationResponse> refreshToken(@RequestBody RefreshRequest request) throws ParseException, JOSEException {
        return ApiResponse.<AuthenticationResponse>builder()
                .result(authenticationService.refreshToken(request))
                .build();
    }
}
