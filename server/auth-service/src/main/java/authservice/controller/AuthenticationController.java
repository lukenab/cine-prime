package authservice.controller;

import authservice.dto.request.LoginRequest;
import authservice.dto.request.IntrospectTokenRequest;
import authservice.dto.request.RefreshTokenRequest;
import authservice.dto.response.LoginResponse;
import authservice.dto.response.IntrospectResponse;
import authservice.service.AuthenticationService;
import com.nimbusds.jose.JOSEException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;
import movie.theater.common.exception.AppException;
import movie.theater.common.exception.GlobalErrorCode;
import org.springframework.web.bind.annotation.*;

import java.text.ParseException;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AuthenticationController {

    AuthenticationService authenticationService;

    @PostMapping("/login")
    ApiResponse<LoginResponse> authenticate(@RequestBody LoginRequest request) {
        return ApiResponse.<LoginResponse>builder()
                .result(authenticationService.authenticate(request))
                .build();
    }

    @PostMapping("/logout")
    ApiResponse<Void> logout(HttpServletRequest request) throws ParseException, JOSEException {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new AppException(GlobalErrorCode.UNAUTHENTICATED);
        }
        String token = authHeader.substring(7);
        authenticationService.logout(token);
        return ApiResponse.<Void>builder()
                .message("Logged out successfully")
                .build();
    }

    @PostMapping("/introspect")
    ApiResponse<IntrospectResponse> introspect(@Valid @RequestBody IntrospectTokenRequest request) {
        return ApiResponse.<IntrospectResponse>builder()
                .result(authenticationService.introspect(request))
                .build();
    }

    @PostMapping("/refresh")
    ApiResponse<LoginResponse> refreshToken(@Valid @RequestBody RefreshTokenRequest request) throws ParseException, JOSEException {
        return ApiResponse.<LoginResponse>builder()
                .result(authenticationService.refreshToken(request))
                .build();
    }
}
