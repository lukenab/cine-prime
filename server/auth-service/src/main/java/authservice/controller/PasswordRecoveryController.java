package authservice.controller;

import authservice.dto.request.ForgotPasswordRequest;
import authservice.dto.request.ResetPasswordRequest;
import authservice.service.PasswordRecoveryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth/password")
@RequiredArgsConstructor
public class PasswordRecoveryController {

    private final PasswordRecoveryService passwordRecoveryService;

    @PostMapping("/forgot")
    ApiResponse<Void> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        passwordRecoveryService.requestReset(request.getEmail());
        return ApiResponse.<Void>builder()
                .message("If an active account exists for that email, a reset link has been sent.")
                .build();
    }

    @PostMapping("/reset")
    ApiResponse<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        passwordRecoveryService.resetPassword(request);
        return ApiResponse.<Void>builder().message("Password reset successfully.").build();
    }
}
