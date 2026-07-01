package authservice.dto.request;

import authservice.validator.DobConstraint;
import jakarta.validation.constraints.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;

/**
 * DTO dùng riêng cho admin tạo account qua POST /api/accounts.
 * Khác với RegisterRequest (public OTP flow) ở chỗ cho phép chỉ định role.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class AdminCreateAccountRequest {

    @NotBlank(message = "Username cannot be blank!")
    @Size(min = 5, max = 50, message = "Username must be between 5 and 50 characters!")
    String username;

    @NotBlank(message = "Password cannot be blank!")
    @Size(min = 8, message = "Password must be at least 8 characters!")
    String password;

    @NotBlank(message = "Email cannot be blank!")
    @Email(message = "Invalid email format (e.g., example@gmail.com)!")
    String email;

    @NotBlank(message = "Full name cannot be blank!")
    String fullName;

    @NotBlank(message = "Phone number cannot be blank!")
    @Pattern(regexp = "^(0[3|5|7|8|9])+([0-9]{8})$", message = "Invalid phone number format!")
    String phoneNumber;

    @NotNull(message = "Date of birth cannot be null!")
    @DobConstraint(min = 18, message = "INVALID_AGE")
    LocalDate dateOfBirth;

    @NotBlank(message = "Gender cannot be blank!")
    String gender;

    @NotBlank(message = "Address cannot be blank!")
    String address;

    @NotBlank(message = "Identity card cannot be blank!")
    @Pattern(regexp = "^[0-9]{12}$", message = "Identity card must contain exactly 12 digits!")
    String identityCard;

    /**
     * Role được gán cho account. Nếu không truyền, mặc định là "USER".
     * Chỉ admin mới được gọi endpoint này — SecurityConfig đã bảo vệ bằng ROLE_ADMIN.
     */
    @Pattern(regexp = "^(USER|ADMIN)$", message = "Role must be USER or ADMIN!")
    String role;
}
